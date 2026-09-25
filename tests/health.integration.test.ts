import { afterAll, describe, expect, it } from "vitest";

import { _resetCacheForTests, cacheGet, cacheKey, cacheSet } from "../src/lib/rag/cache";
import { closePool, getPool } from "../src/lib/rag/db";
import { GET } from "../src/app/api/health/route";

const hasDb = Boolean(process.env.DATABASE_URL);

interface LaneProvider {
  provider: string;
  model: string;
  configured: boolean;
  available: boolean;
  preflight: string;
  calls_today: number;
  errors_today: number;
  benched_until: string | null;
  bench_reason: string | null;
}

interface HealthBody {
  ok: boolean;
  db: { ok: boolean; latency_ms: number | null };
  lanes: { classification: LaneProvider[]; synthesis: LaneProvider[] };
  lane_available: { classification: boolean; synthesis: boolean };
  gemini: { configured: boolean; keys: number };
  cache: {
    hits: number;
    misses: number;
    hit_rate: number;
    l1_hits: number;
    l2_hits: number;
    corpus_version: number;
  };
}

const health = async (): Promise<{ status: number; body: HealthBody }> => {
  const res = await GET();
  return { status: res.status, body: (await res.json()) as HealthBody };
};

describe.skipIf(!hasDb)("GET /api/health (live DB)", () => {
  afterAll(() => closePool());

  it("reports DB status and Gemini key availability", async () => {
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(body.db.ok).toBe(true);
    expect(body.gemini.configured).toBe(true);
    expect(body.gemini.keys).toBeGreaterThan(0);
  });

  it("reports each lane's ladder in fallback order, with per-provider detail", async () => {
    const { body } = await health();

    // Defaults: classification tries the cheap high-RPD lane first, synthesis
    // leads with the best writer. Both fall back rather than dying.
    expect(body.lanes.classification.map((p) => p.provider)).toEqual(["groq", "gemini"]);
    expect(body.lanes.synthesis.map((p) => p.provider)).toEqual([
      "gemini",
      "groq",
      "openrouter",
    ]);

    for (const lane of [body.lanes.classification, body.lanes.synthesis]) {
      for (const p of lane) {
        expect(p.model.length).toBeGreaterThan(0);
        expect(typeof p.configured).toBe("boolean");
        expect(typeof p.available).toBe("boolean");
        expect(["unknown", "ok", "dead"]).toContain(p.preflight);
        expect(p.calls_today).toBeGreaterThanOrEqual(0);
        expect(p.errors_today).toBeGreaterThanOrEqual(0);
      }
    }
    // Same provider in both lanes may run a different model per lane.
    expect(body.lane_available.synthesis).toBe(true);
  });

  it("reports the cache hit rate and the live corpus version", async () => {
    _resetCacheForTests();
    const k = cacheKey("Computer Networks", "__test__ health hit rate", { intent: "TEST" });
    try {
      await cacheGet(k); // miss
      await cacheSet(k, { intent: "ANALYTICS", answer: "x" });
      await cacheGet(k); // hit

      const { body } = await health();
      expect(body.cache.hits).toBe(1);
      expect(body.cache.misses).toBe(1);
      expect(body.cache.hit_rate).toBe(0.5);
      expect(body.cache.l1_hits).toBe(1);
      expect(body.cache.corpus_version).toBeGreaterThan(0);
    } finally {
      await getPool().query("DELETE FROM response_cache WHERE cache_key = $1", [k.key]);
    }
  });

  it("goes 503 only when the synthesis lane has nowhere left to go", async () => {
    const saved = {
      gemini: process.env.GEMINI_API_KEYS,
      groq: process.env.GROQ_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    };
    delete process.env.GEMINI_API_KEYS;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const { status, body } = await health();
      expect(status).toBe(503);
      expect(body.lane_available.synthesis).toBe(false);
      expect(body.lanes.synthesis.every((p) => !p.configured)).toBe(true);
    } finally {
      if (saved.gemini) process.env.GEMINI_API_KEYS = saved.gemini;
      if (saved.groq) process.env.GROQ_API_KEY = saved.groq;
      if (saved.openrouter) process.env.OPENROUTER_API_KEY = saved.openrouter;
    }
  });
});
