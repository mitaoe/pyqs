import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../src/lib/rag/db";
import { embedQuery } from "../src/lib/rag/embed";
import { semanticSearch } from "../src/lib/rag/search";
import { listSubjects } from "../src/lib/rag/subjects";

const hasDb = Boolean(process.env.DATABASE_URL);

const cosine = (x: number[], y: number[]) => {
  let dot = 0;
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < x.length; i++) {
    dot += x[i] * y[i];
    nx += x[i] * x[i];
    ny += y[i] * y[i];
  }
  return dot / (Math.sqrt(nx) * Math.sqrt(ny));
};

// SEMANTIC path: transformers.js query vectors against pipeline-written
// pgvector rows, with subject isolation enforced in SQL.
describe.skipIf(!hasDb)("semantic search (live DB)", () => {
  let subject: string;

  beforeAll(async () => {
    const subjects = await listSubjects();
    subject = subjects.reduce((a, b) => (b.question_count > a.question_count ? b : a)).subject;
  });

  afterAll(() => closePool());

  it("query embeddings live in the same space as the stored corpus", async () => {
    // THE parity check for the query-embedding approach: re-embed real
    // questions with transformers.js (q8 ONNX) and compare against the
    // vectors the Python pipeline stored (fp32 sentence-transformers).
    // If this ever fails, switch lib/embed.ts dtype from "q8" to "fp32".
    const res = await getPool().query(
      `SELECT question_text, embedding::text AS emb
         FROM questions
        WHERE embedding IS NOT NULL
          AND length(question_text) BETWEEN 80 AND 500
        LIMIT 3`,
    );
    expect(res.rows.length).toBe(3);
    for (const row of res.rows as { question_text: string; emb: string }[]) {
      const stored = JSON.parse(row.emb) as number[];
      const requeried = await embedQuery(row.question_text);
      expect(cosine(stored, requeried)).toBeGreaterThan(0.95);
    }
  });

  it("returns top-k hits ordered by similarity, all inside the subject", async () => {
    const vec = await embedQuery("most important definitions and derivations");
    const hits = await semanticSearch(subject, vec, 10);
    expect(hits.length).toBe(10);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].similarity).toBeLessThanOrEqual(hits[i - 1].similarity + 1e-9);
    }
    for (const h of hits) {
      expect(h.standard_subject).toBe(subject); // SQL isolation, verified per row
      expect(h.url).toMatch(/^https?:\/\//);
      expect(h.question_text.length).toBeGreaterThan(0);
      expect(h.similarity).toBeGreaterThanOrEqual(-1);
      expect(h.similarity).toBeLessThanOrEqual(1);
    }
  });

  it("retrieval is on-topic for a subject-specific query", async () => {
    // Take a real stored question, search for it verbatim: the top hit must
    // be (near-)identical, proving the two embedding spaces line up in
    // practice, not just pairwise.
    const res = await getPool().query(
      `SELECT q.question_text, p.standard_subject
         FROM questions q
         JOIN papers p ON p.id = q.paper_id
        WHERE q.embedding IS NOT NULL
          AND p.standard_subject = $1
          AND length(q.question_text) BETWEEN 80 AND 300
        LIMIT 1`,
      [subject],
    );
    const { question_text } = res.rows[0] as { question_text: string };
    const hits = await semanticSearch(subject, await embedQuery(question_text), 10);
    expect(hits[0].similarity).toBeGreaterThan(0.9);
  });

  it("top-k contains only distinct questions even where the corpus has duplicates", async () => {
    // Find a question text that exists multiple times inside this subject
    // (duplicate uploads guarantee thousands of these), search for it, and
    // require the context window to hold k DIFFERENT questions.
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
    const res = await getPool().query(
      `SELECT q.question_text
         FROM questions q
         JOIN papers p ON p.id = q.paper_id
        WHERE p.standard_subject = $1
          AND length(q.question_text) BETWEEN 80 AND 300
        GROUP BY q.question_text
       HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 1`,
      [subject],
    );
    expect(res.rows.length).toBe(1); // the corpus is known to contain duplicates
    const probe = res.rows[0].question_text as string;

    const hits = await semanticSearch(subject, await embedQuery(probe), 10);
    expect(hits.length).toBe(10);
    const normalized = hits.map((h) => norm(h.question_text));
    expect(new Set(normalized).size).toBe(10); // no duplicate slots
    expect(normalized[0]).toBe(norm(probe)); // the duplicate collapsed to one top hit
  });

  it("an unknown subject returns zero rows, never cross-subject leakage", async () => {
    const vec = await embedQuery("anything at all");
    expect(await semanticSearch("__no_such_subject__", vec, 10)).toEqual([]);
  });
});
