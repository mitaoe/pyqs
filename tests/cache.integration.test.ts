import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  _pinCorpusVersionForTests,
  _resetCacheForTests,
  cacheGet,
  cacheKey,
  cacheSet,
  cacheStats,
  corpusVersion,
  filtersHash,
  isDeterministicIntent,
} from "../src/lib/rag/cache";
import { closePool, getPool } from "../src/lib/rag/db";
import { normalizeQuery } from "../src/lib/rag/normalize";
import { POST } from "../src/app/api/ask/route";

const hasDb = Boolean(process.env.DATABASE_URL);

const SUBJECT = "Computer Networks";

const ask = (body: unknown) =>
  POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("cache key identity", () => {
  it("collapses whitespace, case and trailing punctuation", () => {
    const a = cacheKey(SUBJECT, "Most Repeated   Questions?");
    const b = cacheKey(SUBJECT, "most repeated questions");
    expect(a.key).toBe(b.key);
  });

  it("separates subjects", () => {
    expect(cacheKey("A", "q").key).not.toBe(cacheKey("B", "q").key);
  });

  it("separates filters — same words, different question", () => {
    const plain = cacheKey(SUBJECT, "most repeated questions");
    const mse = cacheKey(SUBJECT, "most repeated questions", { examType: "MSE" });
    const y2024 = cacheKey(SUBJECT, "most repeated questions", { year: "2024" });
    expect(new Set([plain.key, mse.key, y2024.key]).size).toBe(3);
  });

  it("separates a client-named intent from the same text typed", () => {
    const typed = cacheKey(SUBJECT, "show me the trends");
    const button = cacheKey(SUBJECT, "show me the trends", { intent: "YEAR_TREND" });
    expect(typed.key).not.toBe(button.key);
  });

  it("hashes filters stably", () => {
    expect(filtersHash({ year: "2024", examType: "MSE" })).toBe(
      filtersHash({ year: "2024", examType: "MSE" }),
    );
  });
});

describe("deterministic vs semantic classification", () => {
  it.each(["ANALYTICS", "TOPIC_ANALYTICS", "TOPIC_WEIGHTAGE", "YEAR_TREND"])(
    "%s is corpus-derived",
    (intent) => expect(isDeterministicIntent(intent)).toBe(true),
  );
  it.each(["SEMANTIC", "STUDY_GUIDE"])("%s is LLM-written", (intent) =>
    expect(isDeterministicIntent(intent)).toBe(false),
  );
});

describe.skipIf(!hasDb)("shared Neon cache (live DB)", () => {
  const keys: string[] = [];

  beforeEach(() => _resetCacheForTests());

  afterAll(async () => {
    if (keys.length > 0) {
      await getPool().query("DELETE FROM response_cache WHERE cache_key = ANY($1)", [keys]);
    }
    await closePool();
  });

  const scratchKey = (label: string) => {
    const k = cacheKey(SUBJECT, `__test__ ${label}`, { intent: "TEST" });
    keys.push(k.key);
    return k;
  };

  it("round-trips a response through L1", async () => {
    const k = scratchKey("l1");
    await cacheSet(k, { intent: "ANALYTICS", answer: "cached answer" });
    const hit = await cacheGet(k);
    expect(hit?.layer).toBe("l1");
    expect(hit?.body.answer).toBe("cached answer");
  });

  it("serves a cold instance from L2 — the point of a shared cache", async () => {
    const k = scratchKey("l2");
    await cacheSet(k, { intent: "ANALYTICS", answer: "written by another instance" });
    // Simulate a DIFFERENT serverless instance: same Neon, empty memory.
    _resetCacheForTests();
    const hit = await cacheGet(k);
    expect(hit?.layer).toBe("l2");
    expect(hit?.body.answer).toBe("written by another instance");
  });

  it("counts hits and misses", async () => {
    const k = scratchKey("counters");
    expect(await cacheGet(k)).toBeNull();
    await cacheSet(k, { intent: "ANALYTICS", answer: "x" });
    await cacheGet(k);
    const s = cacheStats();
    expect(s.misses).toBe(1);
    expect(s.hits).toBe(1);
    expect(s.hit_rate).toBe(0.5);
  });

  // The next two simulate an ingest bump by pinning the version THIS process
  // sees. The live corpus_version row is shared with production and is never
  // written from a test: a live bump, even one restored a moment later, let
  // concurrent instances stamp cache rows with a version the corpus was not at.
  it("retires deterministic entries when the corpus version moves", async () => {
    const k = scratchKey("corpus-bump");
    const live = await corpusVersion();
    await cacheSet(k, { intent: "ANALYTICS", answer: "asked in 30 of 49 exams" });
    expect((await cacheGet(k))?.body.answer).toBe("asked in 30 of 49 exams");

    // What pipeline/bump_corpus_version.py does at the end of an ingest.
    _pinCorpusVersionForTests(live + 1);
    expect(await corpusVersion()).toBe(live + 1);

    // Stale count -> must NOT be served: not the copy still in L1 ...
    expect(await cacheGet(k)).toBeNull();
    // ... nor the L2 row, as a cold instance sees it.
    _resetCacheForTests();
    _pinCorpusVersionForTests(live + 1);
    expect(await cacheGet(k)).toBeNull();

    // The row keeps the version it was written at — nothing here stamps a future one.
    const row = await getPool().query(
      "SELECT corpus_version FROM response_cache WHERE cache_key = $1",
      [k.key],
    );
    expect(Number(row.rows[0].corpus_version)).toBe(live);
  });

  it("keeps semantic entries across a corpus bump (they ride their TTL)", async () => {
    const k = scratchKey("semantic-survives");
    const live = await corpusVersion();
    await cacheSet(k, { intent: "SEMANTIC", answer: "**TCP is connection-oriented.**" });

    _resetCacheForTests();
    _pinCorpusVersionForTests(live + 1);

    const hit = await cacheGet(k);
    expect(hit?.layer).toBe("l2");
    expect(hit?.body.answer).toBe("**TCP is connection-oriented.**");
  });

  it("an expired entry is a miss", async () => {
    const k = scratchKey("expired");
    await cacheSet(k, { intent: "SEMANTIC", answer: "old" });
    await getPool().query(
      "UPDATE response_cache SET expires_at = now() - interval '1 second' WHERE cache_key = $1",
      [k.key],
    );
    _resetCacheForTests();
    expect(await cacheGet(k)).toBeNull();
  });

  it("/api/ask serves the second identical question from cache", async () => {
    // A question only this test asks, keyed exactly as the route keys it, so
    // the live "Most repeated questions" button entry is never deleted.
    const question = "What are the most repeated questions? (cache round-trip test)";
    const k = cacheKey(SUBJECT, normalizeQuery(question), { intent: "ANALYTICS" });
    keys.push(k.key);
    await getPool().query("DELETE FROM response_cache WHERE cache_key = $1", [k.key]);
    _resetCacheForTests();

    const first = await ask({ subject: SUBJECT, question, intent: "ANALYTICS" });
    const firstBody = await first.json();
    expect(firstBody.cached).toBeUndefined();

    // A cold instance (empty L1) must still hit, via Neon.
    _resetCacheForTests();
    const second = await ask({ subject: SUBJECT, question, intent: "ANALYTICS" });
    const secondBody = await second.json();
    expect(secondBody.cached).toBe(true);
    expect(secondBody.answer).toBe(firstBody.answer);
    expect(cacheStats().l2_hits).toBeGreaterThan(0);
  });
});
