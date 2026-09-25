import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { closePool } from "../src/lib/rag/db";
import { EmbeddingsUnavailable } from "../src/lib/rag/vector";

/**
 * The production failure this guards against: on Vercel, importing the
 * embedding stack threw (onnxruntime's native library was missing from the
 * serverless bundle), so every route whose graph reached it answered 500.
 *
 * Two things must hold now. The SQL-only routes never touch that stack at all
 * (tests/module-graph.test.ts pins the graph). And /api/ask, which genuinely
 * needs a query vector, degrades honestly instead of 500ing: the deterministic
 * paths keep answering, and the paths that need an embedding say what is
 * missing and serve the real frequency data instead.
 */
vi.mock("../src/lib/rag/embed", () => ({
  embedQuery: vi.fn(async () => {
    throw new EmbeddingsUnavailable(
      "embedding model unavailable: libonnxruntime.so.1: cannot open shared object file",
    );
  }),
}));

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

interface AskBody {
  intent?: string;
  answer?: string;
  degraded?: boolean;
  cached?: boolean;
  topics?: unknown[];
  clusters?: unknown[];
  total_exams?: number;
  citations?: unknown[];
}

describe.skipIf(!hasDb)("embeddings unavailable (live DB, embedder mocked down)", () => {
  // A cached answer would be served before an embedding is ever attempted.
  beforeAll(() => {
    process.env.RESPONSE_CACHE_DISABLED = "1";
  });
  afterAll(async () => {
    delete process.env.RESPONSE_CACHE_DISABLED;
    await closePool();
  });

  it("a semantic question degrades honestly instead of 500ing", async () => {
    const res = await ask({
      subject: SUBJECT,
      question: "Explain the difference between TCP and UDP.",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.degraded).toBe(true);
    expect(body.answer).toMatch(/temporarily unavailable/i);
    // It says what is missing, then serves real counts rather than nothing.
    expect((body.topics?.length ?? 0) + (body.clusters?.length ?? 0)).toBeGreaterThan(0);
    expect(body.total_exams).toBeGreaterThan(0);
  });

  it("an unlabeled topic query degrades too, never a bluffed zero", async () => {
    const res = await ask({
      subject: SUBJECT,
      question: "what usually gets asked about flurbification theory",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.degraded).toBe(true);
    // The honest-zero answer would be a lie here: with no embedder we do not
    // know whether the archive covers the phrase.
    expect(body.answer).not.toMatch(/appeared in \*\*0\*\*/);
  });

  it("the outage shape is never cached", async () => {
    delete process.env.RESPONSE_CACHE_DISABLED;
    try {
      const first = await ask({ subject: SUBJECT, question: "explain sliding window protocol" });
      expect(first.status).toBe(200);
      const second = await ask({ subject: SUBJECT, question: "explain sliding window protocol" });
      const body = (await second.json()) as AskBody;
      expect(body.cached).toBeUndefined();
    } finally {
      process.env.RESPONSE_CACHE_DISABLED = "1";
    }
  });

  it("deterministic paths are untouched — no embedding needed, no degrade", async () => {
    const res = await ask({
      subject: SUBJECT,
      question: "What are the most repeated questions?",
      intent: "ANALYTICS",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.intent).toBe("ANALYTICS");
    expect(body.degraded).toBeUndefined();
    expect((body.clusters?.length ?? 0)).toBeGreaterThan(0);
  });
});
