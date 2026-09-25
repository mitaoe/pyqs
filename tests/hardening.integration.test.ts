import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { closePool } from "../src/lib/rag/db";

// Simulate EVERY provider in both lanes being out of quota. The lane router
// is the single choke point for all LLM traffic, so failing it here covers
// Gemini, Groq and OpenRouter at once: classification falls back to the regex
// heuristic and synthesis degrades gracefully — the site never goes dark
// because of quota.
//
// (Mocking the router, not one provider, is also why this now actually
// bites: the previous mock pointed at a path that did not exist, so the real
// client was used and the degrade path was never exercised.)
vi.mock("../src/lib/rag/providers", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/lib/rag/providers")>();
  return {
    ...mod,
    generateForLane: vi.fn(async () => {
      throw new mod.ProvidersUnavailable("every provider is exhausted (mocked)");
    }),
  };
});

import { POST } from "../src/app/api/ask/route";

const hasDb = Boolean(process.env.DATABASE_URL);

const ask = (body: unknown) =>
  POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe.skipIf(!hasDb)("quota-exhausted behavior (live DB, mocked Gemini)", () => {
  // The response cache is SHARED via Neon, so "nobody has asked this yet" is
  // no longer implied by a fresh process — an answer another test cached
  // would be served before synthesis is ever attempted. This suite is about
  // what happens when synthesis runs and fails, so it takes the cold path.
  beforeAll(() => {
    process.env.RESPONSE_CACHE_DISABLED = "1";
  });

  afterAll(async () => {
    delete process.env.RESPONSE_CACHE_DISABLED;
    delete process.env.RATE_LIMIT_SYNTH_PER_HOUR;
    await closePool();
  });

  it("zero-match topic queries still lead with the exam total", async () => {
    // Heuristic routes this to TOPIC_ANALYTICS; the nonsense topic matches
    // no clusters — the answer must still open with "appeared in 0 of M".
    const res = await ask({
      subject: "Computer Networks",
      question: "what usually gets asked about flurbification theory",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("TOPIC_ANALYTICS");
    expect(body.topic_exam_count).toBe(0);
    expect(body.answer).toMatch(/^\*\*.+\*\* appeared in \*\*0\*\* of \d+ Computer Networks exams/);
  });

  it("analytics keeps working with Gemini fully down", async () => {
    const res = await ask({
      subject: "Computer Networks",
      question: "What are the most repeated questions?",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("ANALYTICS");
    expect(body.clusters.length).toBeGreaterThan(0);
  });

  it("semantic degrades to raw retrieval instead of failing", async () => {
    const res = await ask({
      subject: "Computer Networks",
      question: "Explain the difference between TCP and UDP.",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.answer).toMatch(/resting until tomorrow/i);
    expect(body.citations.length).toBeGreaterThan(0);
    for (const c of body.citations) expect(c.standard_subject).toBe("Computer Networks");
  });

  it("synthesis rate limit returns a friendly 429 before any Gemini spend", async () => {
    process.env.RATE_LIMIT_SYNTH_PER_HOUR = "0";
    const res = await ask({
      subject: "Computer Networks",
      question: "Explain how congestion control works in detail.",
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/hour's AI answers/i);
  });
});
