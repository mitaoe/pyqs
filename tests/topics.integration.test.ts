import { afterAll, describe, expect, it } from "vitest";

import { MAX_TOPIC_CLUSTERS } from "../src/lib/rag/config";
import { closePool, getPool } from "../src/lib/rag/db";
import {
  labelClusters,
  matchTopicLabel,
  topicQuestions,
  topicWeightage,
  totalExams,
} from "../src/lib/rag/topics";

const hasDb = Boolean(process.env.DATABASE_URL);

// Requires label_topics.py to have run for these subjects (done for
// Computer Networks and Data Structures).
describe.skipIf(!hasDb)("topic weightage (live DB)", () => {
  afterAll(() => closePool());

  it("ranks canonical topics by distinct-exam coverage", async () => {
    const [topics, total] = await Promise.all([
      topicWeightage("Data Structures", 10),
      totalExams("Data Structures"),
    ]);
    expect(total).toBeGreaterThan(0);
    expect(topics.length).toBeGreaterThan(3);
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      // topic names, not raw question texts
      expect(t.topic.length).toBeGreaterThan(2);
      expect(t.topic.length).toBeLessThanOrEqual(80);
      expect(t.topic).not.toMatch(/\?$/);
      expect(t.exam_count).toBeGreaterThanOrEqual(1);
      expect(t.exam_count).toBeLessThanOrEqual(total);
      if (i > 0) expect(t.exam_count).toBeLessThanOrEqual(topics[i - 1].exam_count);
    }
  });

  it("resolves example questions per topic", async () => {
    const topics = await topicWeightage("Computer Networks", 5);
    const questions = await topicQuestions(
      "Computer Networks",
      topics.map((t) => t.topic),
    );
    expect(questions.size).toBeGreaterThan(0);
    for (const list of questions.values()) {
      expect(list.length).toBeLessThanOrEqual(4);
      for (const q of list) expect(q.text.length).toBeGreaterThan(0);
    }
  });

  it("denominator invariant: every count fits the subject's real exam total", async () => {
    for (const subject of ["Data Structures", "Structural Analysis", "Thermal Engineering"]) {
      const [topics, total] = await Promise.all([topicWeightage(subject, 15), totalExams(subject)]);
      for (const t of topics) expect(t.exam_count).toBeLessThanOrEqual(total);
    }
  });

  it("respects a requested size", async () => {
    const topics = await topicWeightage("Data Structures", 5);
    expect(topics.length).toBe(5);
  });

  // Exhaustive-list contract: the label fetch returns EVERY cluster of the
  // label (bounded by MAX_TOPIC_CLUSTERS), verified against a direct count —
  // a reintroduced TOP_K cap would fail this immediately.
  it("labelClusters returns the label's full cluster set (hashing)", async () => {
    const label = await matchTopicLabel("Data Structures", "hashing");
    expect(label).toMatch(/hashing/i);
    const [rows, direct] = await Promise.all([
      labelClusters("Data Structures", label!, MAX_TOPIC_CLUSTERS),
      getPool().query(
        "SELECT COUNT(*)::int AS n FROM clusters WHERE standard_subject = $1 AND topic = $2",
        ["Data Structures", label],
      ),
    ]);
    expect(rows.length).toBe(direct.rows[0].n);
    expect(rows.length).toBeGreaterThan(10); // 15 at time of writing — beyond any TOP_K cap
  });

  it("weightage filters narrow counts and denominators together", async () => {
    const [mse, all, mseTotal, allTotal] = await Promise.all([
      topicWeightage("Data Structures", 10, { examType: "MSE" }),
      topicWeightage("Data Structures", 10),
      totalExams("Data Structures", { examType: "MSE" }),
      totalExams("Data Structures"),
    ]);
    expect(mseTotal).toBeGreaterThan(0);
    expect(mseTotal).toBeLessThan(allTotal);
    expect(mse.length).toBeGreaterThan(0);
    for (const t of mse) expect(t.exam_count).toBeLessThanOrEqual(mseTotal);
    // the MSE-only leader count can never exceed its all-exams count
    const allByTopic = new Map(all.map((t) => [t.topic, t.exam_count]));
    for (const t of mse) {
      const unfiltered = allByTopic.get(t.topic);
      if (unfiltered != null) expect(t.exam_count).toBeLessThanOrEqual(unfiltered);
    }
  });
});
