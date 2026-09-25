import { afterAll, describe, expect, it } from "vitest";

import { closePool } from "../src/lib/rag/db";
import { getStats } from "../src/lib/rag/stats";
import { listSubjects, subjectExists } from "../src/lib/rag/subjects";

const hasDb = Boolean(process.env.DATABASE_URL);

// Live-database checks of /api/subjects and /api/stats query logic against
// the fully ingested corpus (~4.6k papers, ~50k questions).
describe.skipIf(!hasDb)("subjects + stats (live DB)", () => {
  afterAll(() => closePool());

  it("lists subjects with real counts", async () => {
    const subjects = await listSubjects();
    expect(subjects.length).toBeGreaterThan(10);
    for (const s of subjects) {
      expect(s.subject).toBeTruthy();
      expect(typeof s.question_count).toBe("number");
      expect(s.question_count).toBeGreaterThan(0);
      expect(s.paper_count).toBeGreaterThan(0);
    }
    // sorted and unique
    const names = subjects.map((s) => s.subject);
    expect(names).toEqual([...new Set(names)].sort());
  });

  it("subjectExists matches the subject list", async () => {
    const [first] = await listSubjects();
    expect(await subjectExists(first.subject)).toBe(true);
    expect(await subjectExists("__no_such_subject__")).toBe(false);
  });

  it("stats reflect the fully processed corpus", async () => {
    const stats = await getStats();
    expect(stats.papers.done).toBeGreaterThan(4000);
    expect(stats.questions.total).toBeGreaterThan(40_000);
    // Pipeline reported everything embedded + clustered; allow a whisker of
    // drift from papers ingested after the last embed/cluster run.
    expect(stats.questions.embedded).toBeGreaterThanOrEqual(stats.questions.total * 0.99);
    expect(stats.questions.clustered).toBeGreaterThanOrEqual(stats.questions.total * 0.9);
    expect(stats.clusters).toBeGreaterThan(0);
    expect(stats.subjects.length).toBeGreaterThan(10);
    const perSubject = stats.subjects.reduce((s, x) => s + x.question_count, 0);
    expect(perSubject).toBeLessThanOrEqual(stats.questions.total);
  });
});
