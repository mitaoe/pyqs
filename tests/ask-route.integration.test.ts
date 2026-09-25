import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "../src/app/api/ask/route";
import { closePool } from "../src/lib/rag/db";
import { listSubjects } from "../src/lib/rag/subjects";

const hasDb = Boolean(process.env.DATABASE_URL);
// Semantic synthesis needs a live Gemini key (rotated pool); the analytics
// path is deterministic SQL + formatting and runs without any key.
const hasGemini = Boolean(process.env.GEMINI_API_KEYS);

const ask = (body: unknown) =>
  POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe.skipIf(!hasDb)("POST /api/ask (live DB)", () => {
  let subject: string;

  beforeAll(async () => {
    const subjects = await listSubjects();
    subject = subjects.reduce((a, b) => (b.question_count > a.question_count ? b : a)).subject;
  });

  afterAll(() => closePool());

  it("rejects a missing subject/question with 400", async () => {
    expect((await ask({})).status).toBe(400);
    expect((await ask({ subject: "x" })).status).toBe(400);
  });

  it("rejects an unknown subject with 404", async () => {
    const res = await ask({ subject: "__no_such_subject__", question: "most repeated questions" });
    expect(res.status).toBe(404);
  });

  it("answers an analytics question with ranked real counts", async () => {
    const res = await ask({ subject, question: "What are the most repeated questions?" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("ANALYTICS");
    expect(body.clusters.length).toBeGreaterThan(0);
    expect(body.answer).toContain("Most frequently asked");
    // counts in the answer come straight from SQL rows (distinct exams)
    expect(body.answer).toContain(`**${body.clusters[0].exam_count}** exam`);
    expect(body.clusters[0].sources.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasGemini)("answers a semantic question with [n]-cited sources", async () => {
    // Pinned to a corpus-anchored query so the grounding floor is cleared.
    const subject = "Computer Networks";
    const res = await ask({
      subject,
      question: "Explain the difference between TCP and UDP.",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("SEMANTIC");
    expect(body.answer.length).toBeGreaterThan(0);
    expect(body.answer).toMatch(/\[\d+\]/); // inline citation markers
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.citations.length).toBeLessThanOrEqual(10);
    for (const c of body.citations) {
      expect(c.url).toMatch(/^https?:\/\//);
      expect(c.standard_subject).toBe(subject);
    }
  });

  // Conceptual questions about corpus topics must EXPLAIN, anchored to
  // retrieved questions — never dead-end in no-answer or a refusal.
  it.skipIf(!hasGemini)("explains a conceptual corpus question with citations", async () => {
    const res = await ask({
      subject: "Data Structures",
      question: "difference between stack and queue",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).not.toBe("REFUSED");
    expect(body.no_answer).not.toBe(true);
    expect(body.answer.length).toBeGreaterThan(50);
    if (body.intent === "SEMANTIC" && !body.degraded) {
      expect(body.citations.length).toBeGreaterThan(0);
    }
  });

  // Numbered references: resolvable from history -> worked solution with the
  // caution; unresolvable -> a clarifying question, never a guessed list.
  it.skipIf(!hasGemini)("solve question N resolves against history or asks", async () => {
    const noContext = await ask({
      subject: "Data Structures",
      question: "solve question 2 step by step",
    });
    expect(noContext.status).toBe(200);
    const ncBody = await noContext.json();
    expect(ncBody.clarification).toBe(true);
    expect(ncBody.answer).toMatch(/which question/i);
    expect(ncBody.clusters ?? []).toHaveLength(0);

    const withContext = await ask({
      subject: "Data Structures",
      question: "solve question 2 step by step",
      history: [
        { role: "user", content: "most repeated questions" },
        {
          role: "assistant",
          content:
            '1. "Define hash function and collision resolution." — asked in **9** exams\n2. "Explain linear probing with an example." — asked in **7** exams',
        },
      ],
    });
    expect(withContext.status).toBe(200);
    const wcBody = await withContext.json();
    expect(wcBody.intent).toBe("SEMANTIC");
    expect(wcBody.clarification).toBeUndefined();
    if (!wcBody.degraded && !wcBody.no_answer) {
      expect(wcBody.answer).toMatch(/verify|cross-check|caution/i);
    }
  });

  it.skipIf(!hasGemini)("bare 'explain this' without history asks what", async () => {
    const res = await ask({ subject: "Data Structures", question: "explain this" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clarification).toBe(true);
    expect(body.answer).toMatch(/referring to/i);
  });

  // Filter propagation to weightage: MSE-denominator ranking with the
  // filter echoed, whatever intent the classifier picks for the phrasing.
  it.skipIf(!hasGemini)("'which topics to focus in MSE' returns MSE-scoped weightage", async () => {
    const res = await ask({
      subject: "Data Structures",
      question: "which topics should I focus on in MSE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(["TOPIC_WEIGHTAGE", "STUDY_GUIDE"]).toContain(body.intent);
    expect(body.filters?.exam_type).toBe("MSE");
    expect(body.total_exams).toBeGreaterThan(0);
    for (const t of body.topics ?? []) {
      expect(t.exam_count).toBeLessThanOrEqual(body.total_exams);
    }
    if (body.intent === "TOPIC_WEIGHTAGE") {
      expect(body.answer).toContain("MSE");
    }
  });

  it.skipIf(!hasGemini)("honest-zero for a topic-shaped unknown term", async () => {
    const res = await ask({
      subject: "Computer Networks",
      question: "what usually gets asked about flurbification theory",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("TOPIC_ANALYTICS");
    expect(body.answer).toMatch(/appeared in \*\*0\*\* of \d+/);
  });
});
