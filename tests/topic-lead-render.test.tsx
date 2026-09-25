import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AnswerView from "../src/components/assistant/AnswerView";
import type { AskResponse, ClusterResult, TopicResult } from "../src/lib/rag/api-types";

const cluster = (id: number, text: string): ClusterResult => ({
  cluster_id: id,
  representative_text: text,
  question_count: 8,
  exam_count: 5,
  years_spanned: "2019,2020,2024",
  topic_similarity: 0.61,
  sources: [{ file_name: `p${id}.pdf`, year: "2024", exam_type: "ESE", url: `https://x/${id}.pdf` }],
});

const render = (res: AskResponse) => renderToStaticMarkup(<AnswerView res={res} msgId={1} />);

// Regression: the API answer led with the total, but the nonzero-cluster
// path rendered only the structured list — the lead never reached the user.
describe("scope-true labels", () => {
  it("weightage expander header shows the REAL cluster count, not the preview slice", () => {
    const topic: TopicResult = {
      topic: "Doubly Linked List Operations",
      exam_count: 30,
      total_marks: 322,
      cluster_count: 25, // DB truth
      years: ["2017", "2024"],
      questions: [
        { text: "q1", exam_count: 7 },
        { text: "q2", exam_count: 5 },
        { text: "q3", exam_count: 4 },
        { text: "q4", exam_count: 2 }, // 4-item preview
      ],
    };
    const html = render({
      intent: "TOPIC_WEIGHTAGE",
      subject: "Data Structures",
      answer: "**Verdict.**",
      topics: [topic],
      total_exams: 49,
    });
    expect(html).toContain("Questions (25)");
    expect(html).not.toContain("Questions (4)");
    expect(html).toContain("Preview of 4 shown.");
  });

  it("cluster sources header shows the true total with a preview note", () => {
    const html = render({
      intent: "ANALYTICS",
      answer: "**x**",
      total_exams: 49,
      clusters: [
        {
          ...cluster(1, "Define hash function."),
          source_total: 9,
        },
      ],
    });
    expect(html).toContain("Sources (9)");
    expect(html).toContain("Showing the 1 most recent of 9 papers.");
  });
});

describe("TOPIC_ANALYTICS total lead rendering", () => {
  it("renders the lead FIRST when clusters are nonempty", () => {
    const html = render({
      intent: "TOPIC_ANALYTICS",
      topic: "hashing",
      topic_exam_count: 15,
      total_exams: 49,
      answer:
        "**hashing** appeared in **15** of 49 Data Structures exams.\n\nThe 2 matching question groups:",
      clusters: [cluster(1, "Define hash function and collision."), cluster(2, "Explain linear probing.")],
    });
    expect(html).toContain("appeared in");
    expect(html).toContain(">15</span>");
    expect(html).toContain("of 49 exams");
    // the lead must precede the first cluster's text
    const leadAt = html.indexOf("appeared in");
    const firstClusterAt = html.indexOf("Define hash function");
    expect(leadAt).toBeGreaterThan(-1);
    expect(firstClusterAt).toBeGreaterThan(-1);
    expect(leadAt).toBeLessThan(firstClusterAt);
  });

  it("renders the lead exactly once on the zero-match path (via answer markdown)", () => {
    const html = render({
      intent: "TOPIC_ANALYTICS",
      topic: "flurbification",
      topic_exam_count: 0,
      total_exams: 49,
      answer:
        "**flurbification** appeared in **0** of 49 Computer Networks exams. Either it isn't asked in this subject's papers, or the phrasing differs.",
      clusters: [],
    });
    expect(html.match(/appeared in/g)?.length).toBe(1);
    expect(html).toContain("flurbification");
  });

  it("labels the lead with the active filter", () => {
    const html = render({
      intent: "TOPIC_ANALYTICS",
      topic: "hashing",
      topic_exam_count: 3,
      total_exams: 9,
      filters: { year: "2024", exam_type: "MSE" },
      answer: "**hashing** appeared in **3** of 9 exams (MSE 2024 only).",
      clusters: [cluster(1, "Define hash function and collision.")],
    });
    expect(html).toContain("(MSE 2024 only)");
  });
});
