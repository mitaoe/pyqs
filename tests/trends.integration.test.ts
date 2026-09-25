import { afterAll, describe, expect, it } from "vitest";

import { closePool } from "../src/lib/rag/db";
import { matchTopicLabel, labelExamCount, topicWeightage } from "../src/lib/rag/topics";
import { yearTrend } from "../src/lib/rag/trends";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("year trend + label-first retrieval (live DB)", () => {
  afterAll(() => closePool());

  it("builds a consistent per-year trend for a labeled subject", async () => {
    const trend = await yearTrend("Data Structures");
    expect(trend).not.toBeNull();
    const { years, topics, staples } = trend!;
    expect(years.length).toBeGreaterThan(2);
    expect([...years].sort()).toEqual(years); // ascending
    expect(topics.length).toBeGreaterThan(3);
    const latest = Number(years[years.length - 1]);
    for (const t of topics) {
      expect(t.counts.length).toBe(years.length);
      expect(t.counts.reduce((s, n) => s + n, 0)).toBe(t.exam_count); // aligned
      if (t.status === "rising") expect(Number(t.first_year)).toBeGreaterThanOrEqual(latest - 2);
      if (t.status === "fading") expect(Number(t.last_year)).toBeLessThanOrEqual(latest - 2);
      if (t.status === "staple") {
        expect(Number(t.first_year)).toBeLessThanOrEqual(latest - 3);
        expect(Number(t.last_year)).toBeGreaterThanOrEqual(latest - 1);
      }
    }
    expect(staples.length).toBeGreaterThan(0); // DS has 2017-era evergreens
  });

  it("matches close phrases to canonical labels, refusing ambiguity", async () => {
    expect(await matchTopicLabel("Data Structures", "doubly linked list")).toBe(
      "Doubly Linked List Operations",
    );
    // generic phrase fits doubly AND circular — must stay unmatched
    expect(await matchTopicLabel("Data Structures", "linked list")).toBeNull();
    expect(await matchTopicLabel("Data Structures", "flurbification theory")).toBeNull();
  });

  it("label exam count equals the weightage table's figure exactly", async () => {
    const weightage = await topicWeightage("Data Structures", 10);
    const row = weightage.find((t) => t.topic === "Doubly Linked List Operations");
    expect(row).toBeDefined();
    const count = await labelExamCount("Data Structures", "Doubly Linked List Operations");
    expect(count).toBe(row!.exam_count);
  });
});
