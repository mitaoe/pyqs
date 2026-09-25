import { describe, expect, it } from "vitest";

import { checkResponseInvariants } from "../src/lib/rag/invariants";
import type { SubjectStats } from "../src/lib/rag/subject-stats";

const stats = (over: Partial<SubjectStats> = {}): SubjectStats => ({
  exams: 49,
  questions: 927,
  clusters: 397,
  distinct_years: 7,
  pct_figure: 0.05,
  text_twin_risk: 0,
  ...over,
});

const ok = { stats: stats(), filtersActive: false };

describe("checkResponseInvariants", () => {
  it("passes a clean weightage response", () => {
    const v = checkResponseInvariants(
      {
        intent: "TOPIC_WEIGHTAGE",
        answer: "**X** leads — in **30** of 49 exams. Top 10 of 150 topics below.",
        total_exams: 49,
        topic_count: 150,
        topics: [{ exam_count: 30, cluster_count: 25, questions: [{}, {}, {}, {}] }],
      },
      ok,
    );
    expect(v).toEqual([]);
  });

  it("flags counts exceeding denominators", () => {
    const v = checkResponseInvariants(
      { intent: "ANALYTICS", answer: "**x**", total_exams: 10, clusters: [{ exam_count: 12, sources: [] }] },
      ok,
    );
    expect(v.map((x) => x.invariant)).toContain("denominator");
  });

  it("flags preview lengths exceeding nested totals", () => {
    const v = checkResponseInvariants(
      {
        intent: "TOPIC_WEIGHTAGE",
        answer: "**x** Top 1 of 150 topics below.",
        topic_count: 150,
        topics: [{ exam_count: 5, cluster_count: 2, questions: [{}, {}, {}] }],
      },
      ok,
    );
    expect(v.map((x) => x.invariant)).toContain("nested-totals");
  });

  it("flags capped lists without a scope statement", () => {
    const v = checkResponseInvariants(
      {
        intent: "TOPIC_ANALYTICS",
        answer: "**hashing** appeared in **15** of 49 exams.",
        total_exams: 49,
        cluster_total: 25,
        clusters: Array(10).fill({ exam_count: 3, sources: [] }),
      },
      ok,
    );
    expect(v.map((x) => x.invariant)).toContain("scope-fidelity");
  });

  it("flags active filters that are not echoed", () => {
    const v = checkResponseInvariants(
      { intent: "ANALYTICS", answer: "**x**", total_exams: 9, clusters: [] },
      { stats: stats(), filtersActive: true },
    );
    expect(v.map((x) => x.invariant)).toContain("filter-propagation");
  });

  it("flags skip candidates above the tail threshold", () => {
    const v = checkResponseInvariants(
      {
        intent: "STUDY_GUIDE",
        answer: "**Skip only X.** The rest is not skippable.",
        skip_candidates: [{ topic: "Y", exam_count: 19 }],
      },
      ok,
    );
    expect(v.map((x) => x.invariant)).toContain("skip-safety");
  });

  it("flags small-corpus responses without the caveat", () => {
    const v = checkResponseInvariants(
      {
        intent: "ANALYTICS",
        answer: "**x** Top 3 of 5 question groups.",
        total_exams: 2,
        clusters: [{ exam_count: 1, sources: [] }],
      },
      { stats: stats({ exams: 2, questions: 40 }), filtersActive: false },
    );
    const kinds = v.map((x) => x.invariant);
    expect(kinds).toContain("small-corpus");
  });

  it("never flags legitimate angle-bracket content", () => {
    const v = checkResponseInvariants(
      { intent: "SEMANTIC", answer: "**Use vector<int> for the heap [1].**" },
      ok,
    );
    expect(v).toEqual([]);
  });

  it("flags internal vocabulary", () => {
    const v = checkResponseInvariants(
      { intent: "STUDY_GUIDE", answer: "Based on topic_weightage_data, start with X." },
      ok,
    );
    expect(v.map((x) => x.invariant)).toContain("no-internal-vocab");
  });
});
