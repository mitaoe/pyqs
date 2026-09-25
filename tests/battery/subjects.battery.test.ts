import { beforeAll, describe, expect, it } from "vitest";

/**
 * Canonical query battery, run per subject against a live server. Asserts
 * STRUCTURAL invariants only (intents, denominators, caveats, contracts) —
 * never content. Degraded responses (Gemini RPM) are retried once, then
 * tolerated where the degradation itself is the designed behavior.
 *
 *   SUBJECTS="Data Structures,Computer Networks" npm run test:subjects
 */
const BASE = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SUBJECTS = (process.env.SUBJECTS ?? "Data Structures,Computer Networks")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_SECONDS = 60;
const INTERNAL = /topic_weightage_data|rarely_asked_topics|retrieved_questions|<\/?[a-z_]+>/i;

interface Res {
  status: number;
  ms: number;
  body: {
    intent?: string;
    answer?: string;
    degraded?: boolean;
    no_answer?: boolean;
    small_corpus?: boolean;
    total_exams?: number;
    topic_exam_count?: number;
    topics?: { topic: string; exam_count: number }[];
    clusters?: { exam_count: number }[];
    skip_candidates?: { topic: string; exam_count: number }[];
    trend?: { years: string[]; topics: { status: string | null }[] };
    citations?: unknown[];
  };
}

async function ask(subject: string, question: string): Promise<Res> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, question }),
  });
  return { status: res.status, ms: Date.now() - t0, body: await res.json() };
}

async function askRetry(subject: string, question: string): Promise<Res> {
  let r = await ask(subject, question);
  if (r.status === 200 && r.body.degraded) {
    await new Promise((f) => setTimeout(f, 20_000));
    r = await ask(subject, question);
  }
  return r;
}

/** Common invariants for every 200 response. */
function base(r: Res) {
  expect(r.status).toBe(200);
  expect(r.ms).toBeLessThan(MAX_SECONDS * 1000);
  expect(String(r.body.answer ?? "")).not.toBe("");
  expect(r.body.answer!).not.toMatch(INTERNAL);
}

function countsWithin(r: Res) {
  const total = r.body.total_exams;
  if (total == null) return;
  for (const c of r.body.clusters ?? []) expect(c.exam_count).toBeLessThanOrEqual(total);
  for (const t of r.body.topics ?? []) expect(t.exam_count).toBeLessThanOrEqual(total);
  if (r.body.topic_exam_count != null) {
    expect(r.body.topic_exam_count).toBeLessThanOrEqual(total);
  }
}

describe.each(SUBJECTS)("battery: %s", (subject) => {
  let topTopic: string | null = null;
  let small = false;

  beforeAll(async () => {
    const r = await ask(subject, "topic-wise weightage");
    topTopic = r.body.topics?.[0]?.topic ?? null;
    small = r.body.small_corpus === true;
  });

  it("most repeated questions -> ANALYTICS within denominators", async () => {
    const r = await ask(subject, "What are the most repeated questions?");
    base(r);
    expect(r.body.intent).toBe("ANALYTICS");
    expect((r.body.clusters ?? []).length).toBeGreaterThan(0);
    countsWithin(r);
    if (small) expect(r.body.answer).toMatch(/small archive/i);
  });

  it("weightage -> TOPIC_WEIGHTAGE with verdict lead", async () => {
    const r = await ask(subject, "topic-wise weightage");
    base(r);
    expect(r.body.intent).toBe("TOPIC_WEIGHTAGE");
    expect((r.body.topics ?? []).length).toBeGreaterThan(0);
    countsWithin(r);
    expect(r.body.answer!.trim()).toMatch(/^\*\*/);
    if (small) expect(r.body.answer).toMatch(/small archive/i);
  });

  it("year trend -> real years only, honest about thin coverage", async () => {
    const r = await ask(subject, "Show me the year-wise trends");
    base(r);
    if (r.body.intent !== "YEAR_TREND") return; // unlabeled fallback tolerated
    const years = r.body.trend?.years ?? [];
    for (const y of years) expect(y).toMatch(/^20\d{2}$/);
    if (years.length < 3) {
      for (const t of r.body.trend?.topics ?? []) expect(t.status).toBeNull();
      expect(r.body.answer).toMatch(/too few/i);
    }
    expect(r.body.answer).toMatch(/archive coverage|too few/i);
  });

  it("study first -> STUDY_GUIDE with lead (caveat first when small)", async () => {
    const r = await askRetry(subject, "what should I study first");
    base(r);
    if (r.body.degraded) return; // designed degradation under RPM pressure
    expect(r.body.intent).toBe("STUDY_GUIDE");
    expect(r.body.answer!.trim()).toMatch(small ? /^\*/ : /^\*\*/);
    if (small) expect(r.body.answer).toMatch(/small archive/i);
  });

  it("skip -> tail-only candidates, 'not skippable' present", async () => {
    const r = await askRetry(subject, "which topics can I skip if I'm short on time?");
    base(r);
    if (r.body.degraded) return;
    expect(r.body.intent).toBe("STUDY_GUIDE");
    expect(r.body.answer).toMatch(/not skippable/i);
    for (const t of r.body.skip_candidates ?? []) {
      expect(t.exam_count).toBeLessThanOrEqual(3);
    }
  });

  it("topic count query -> lead with N of M", async () => {
    if (!topTopic) return;
    const r = await ask(subject, `how many times has ${topTopic} been asked`);
    base(r);
    expect(r.body.intent).toBe("TOPIC_ANALYTICS");
    expect(r.body.answer).toMatch(/appeared in \*\*\d+\*\* of \d+/);
    countsWithin(r);
  });

  it("semantic explain -> grounded answer or honest no-answer", async () => {
    if (!topTopic) return;
    const r = await askRetry(subject, `explain ${topTopic} in simple words`);
    base(r);
    expect(["SEMANTIC", "TOPIC_ANALYTICS", "TOPIC_WEIGHTAGE"]).toContain(r.body.intent);
    if (r.body.intent === "SEMANTIC" && !r.body.no_answer && !r.body.degraded) {
      expect((r.body.citations ?? []).length).toBeGreaterThan(0);
    }
  });

  it("typo'd important-questions never dead-ends", async () => {
    const r = await ask(subject, "important questiions to study");
    base(r);
    expect(r.body.no_answer).toBeUndefined();
    expect(["ANALYTICS", "TOPIC_WEIGHTAGE", "STUDY_GUIDE"]).toContain(r.body.intent);
  });

  it("should-I-prioritize -> Yes/No verdict", async () => {
    if (!topTopic) return;
    const r = await askRetry(subject, `should I prioritize ${topTopic}?`);
    base(r);
    if (r.body.degraded) return;
    expect(r.body.intent).toBe("STUDY_GUIDE");
    expect(r.body.answer!.trim()).toMatch(small ? /^\*/ : /^\*\*\s*(Yes|No)/i);
  });
});
