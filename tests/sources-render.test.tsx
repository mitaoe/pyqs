import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AnswerView from "../src/components/assistant/AnswerView";
import type { AskResponse, Citation } from "../src/lib/rag/api-types";

const cite = (ref: number, similarity: number): Citation => ({
  ref,
  question_text: `Question ${ref}`,
  marks: 5,
  sub_label: null,
  file_name: `paper-${ref}.pdf`,
  year: "2023",
  exam_type: "ESE",
  url: `https://example.com/${ref}.pdf`,
  standard_subject: "Data Structures",
  similarity,
});

function render(refs: [number, number][], threadActive: boolean): string {
  const res: AskResponse = {
    intent: "SEMANTIC",
    answer: "An answer.",
    citations: refs.map(([r, s]) => cite(r, s)),
  };
  return renderToStaticMarkup(
    <AnswerView res={res} msgId={7} threadActive={threadActive} />
  );
}

describe("Sources section", () => {
  it("renders compact rows with file name, chips and a real match-% badge", () => {
    const html = render([[1, 0.82]], true);
    expect(html).toContain("Sources");
    expect(html).toContain("paper-1.pdf");
    expect(html).toContain('data-source-file="paper-1.pdf"');
    expect(html).toContain('data-source-ref="1"');
    // Match-% is the rounded real similarity — the only percentage allowed.
    expect(html).toContain("82%");
    // Anchors carry the jump id + open the real paper URL.
    expect(html).toContain('id="cite-7-1"');
    expect(html).toContain('href="https://example.com/1.pdf"');
  });

  it("collapses beyond the first three with an 'N more' control", () => {
    const html = render(
      [
        [1, 0.9],
        [2, 0.8],
        [3, 0.7],
        [4, 0.6],
        [5, 0.5],
      ],
      true
    );
    expect(html).toContain("2 more"); // 5 - 3
    // Rows 4 and 5 are folded away until expanded.
    expect(html).not.toContain('data-source-ref="4"');
  });

  it("marks the section active only when threadActive (thread anchor)", () => {
    expect(render([[1, 0.8]], true)).toContain("data-sources-active");
    expect(render([[1, 0.8]], false)).not.toContain("data-sources-active");
  });

  it("omits the match-% badge when similarity is absent (no invented metric)", () => {
    const res: AskResponse = {
      intent: "SEMANTIC",
      answer: "An answer.",
      citations: [{ ...cite(1, 0), similarity: undefined as unknown as number }],
    };
    const html = renderToStaticMarkup(<AnswerView res={res} msgId={1} />);
    expect(html).not.toContain("%");
  });
});
