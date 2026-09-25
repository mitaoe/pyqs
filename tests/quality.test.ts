import { describe, expect, it } from "vitest";

import { checkAnswerQuality, countWords, skipContractViolation } from "../src/lib/rag/quality";

describe("checkAnswerQuality", () => {
  const good =
    "**Start with Doubly Linked List Operations — 30 of 49 exams.**\n\n- Learn insert/delete first. Draw the pointers.\n- Then drill **Circular Queue Implementation** (30 exams).\n- Finish with **Hashing** (18 exams) [1][2].";

  it("passes a compliant verdict-first answer", () => {
    const v = checkAnswerQuality(good, { maxWords: 120 });
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it("flags answers over the word cap", () => {
    const long = `**Verdict.** ${Array(130).fill("word").join(" ")}`;
    const v = checkAnswerQuality(long, { maxWords: 120 });
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/too long/);
  });

  it.each([
    "To maximize your efficiency, start with trees.",
    "It is important to note that stacks recur.",
    "Focus on this high-value area first.",
    "These are long-standing staples of the paper.",
    "Leverage the exam data to delve into hashing.",
  ])("flags banned phrase in: %s", (s) => {
    const v = checkAnswerQuality(`**Verdict.** ${s}`, { maxWords: 200 });
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/banned phrase/);
  });

  it("flags a missing bold verdict line", () => {
    const v = checkAnswerQuality("Start with linked lists. They repeat a lot.", { maxWords: 120 });
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/verdict/);
  });

  it("can exempt refusal-shaped answers from verdict-first", () => {
    const v = checkAnswerQuality("The retrieved previous-year questions don't cover this topic.", {
      maxWords: 120,
      requireVerdictFirst: false,
    });
    expect(v.ok).toBe(true);
  });

  it("counts prose words, not markdown or citation markers", () => {
    expect(countWords("**Two words** [1][2]")).toBe(2);
  });
});

describe("skipContractViolation", () => {
  const PROTECTED = ["Doubly Linked List Operations", "Hashing & Collision Resolution"];

  it("passes a compliant skip answer", () => {
    const s =
      "**Skip only AVL Tree Rotations and Backtracking Algorithms.** The top topics like Doubly Linked List Operations are not skippable.\n- Skip **AVL Tree Rotations** — 1 of 49 exams.";
    expect(skipContractViolation(s, PROTECTED)).toBeNull();
  });

  it("flags a missing 'not skippable' statement", () => {
    expect(skipContractViolation("**Skip AVL Tree Rotations.**", PROTECTED)).toMatch(
      /not skippable/,
    );
  });

  it("flags a protected topic named as a skip candidate", () => {
    const s =
      "**Save time by dropping the low performers — the rest is not skippable.** You can skip Hashing & Collision Resolution to save time.";
    expect(skipContractViolation(s, PROTECTED)).toMatch(/Hashing & Collision Resolution/);
  });

  it("does not flag protected topics inside protective sentences", () => {
    const s =
      "**Skip only the tail.** Never skip Doubly Linked List Operations — it is not skippable.";
    expect(skipContractViolation(s, PROTECTED)).toBeNull();
  });
});
