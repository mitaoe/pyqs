import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AnswerView from "../src/components/assistant/AnswerView";
import { normalizeCitations } from "../src/lib/rag/answer";
import type { AskResponse } from "../src/lib/rag/api-types";

const citation = (ref: number) => ({
  ref,
  question_text: `Question number ${ref}`,
  marks: 5,
  sub_label: null,
  file_name: `paper-${ref}.pdf`,
  year: "2023",
  exam_type: "ESE",
  url: `https://example.com/${ref}.pdf`,
  standard_subject: "Computer Networks",
  similarity: 0.8,
});

function renderSemantic(answer: string, refs: number[]): string {
  const res: AskResponse = {
    intent: "SEMANTIC",
    answer,
    citations: refs.map(citation),
  };
  return renderToStaticMarkup(<AnswerView res={res} msgId={1} />);
}

describe("citation marker rendering", () => {
  it("renders single markers as chips", () => {
    const html = renderSemantic("TCP is reliable [1].", [1]);
    expect(html).toContain(">1</button>");
    expect(html).not.toContain("[1]");
  });

  it("adjacent markers [1][7] render as two chips, never bare '17'", () => {
    const html = renderSemantic("Both protocols appear [1][7] in papers.", [1, 7]);
    expect(html).toContain(">1</button>");
    expect(html).toContain(">7</button>");
    // the reported bug: adjacent markers collapsing into plain "17"
    expect(html).not.toMatch(/>\s*17\s*</);
    expect(html).not.toMatch(/appear\s*17/);
    // chips must never sit flush — visually that also reads as "17"
    expect(html).not.toContain("</button><button");
  });

  it("triple adjacency and punctuation survive", () => {
    const html = renderSemantic("Compare [2][5][10], then decide.", [2, 5, 10]);
    for (const n of [2, 5, 10]) expect(html).toContain(`>${n}</button>`);
  });

  it("comma groups like [1, 5] expand to one chip per number", () => {
    const html = renderSemantic("Both approaches appear [1, 5] in papers.", [1, 5]);
    expect(html).toContain(">1</button>");
    expect(html).toContain(">5</button>");
    expect(html).not.toContain("[1, 5]");
    expect(html).not.toMatch(/appear\s*1,\s*5/);
  });

  it("'and' groups like [1, 3, 5, and 6] expand fully", () => {
    const html = renderSemantic("This is required by [1, 3, 5, and 6].", [1, 3, 5, 6]);
    for (const n of [1, 3, 5, 6]) expect(html).toContain(`>${n}</button>`);
    expect(html).not.toMatch(/required by\s*1,\s*3/);
    expect(html).not.toContain("and 6]");
  });

  it("server-side contract repair: literal transcript string 'as seen in 9'", () => {
    expect(normalizeCitations("This appears frequently, as seen in 9.", 10)).toBe(
      "This appears frequently, as seen in [9].",
    );
  });

  it("server-side contract repair: literal transcript string '1, 2, 4, 7, and 10'", () => {
    expect(normalizeCitations("This is required by 1, 2, 4, 7, and 10.", 10)).toBe(
      "This is required by [1][2][4][7][10].",
    );
  });

  it("server-side contract repair: bracket and paren groups", () => {
    expect(normalizeCitations("Compare [1, 5] and [2, 3, and 6].", 10)).toBe(
      "Compare [1][5] and [2][3][6].",
    );
    expect(normalizeCitations("Both variants appear (2, 7).", 10)).toBe(
      "Both variants appear ([2][7]).",
    );
  });

  it("server-side contract repair: full-width brackets from gpt-oss", () => {
    // Real Groq output shape. Left alone these render as literal text and
    // every source silently stops being clickable.
    expect(
      normalizeCitations("TCP is connection-oriented\u30101\u3011\u30102\u3011.", 10),
    ).toBe("TCP is connection-oriented[1][2].");
    expect(normalizeCitations("Use UDP for DNS\uFF3B3\uFF3D.", 10)).toBe("Use UDP for DNS[3].");
  });

  it("full-width citations render as chips end-to-end", () => {
    const normalized = normalizeCitations(
      "TCP is reliable\u30101\u3011\u30102\u3011 while UDP is not\u30105\u3011.",
      10,
    );
    const html = renderSemantic(normalized, [1, 2, 5]);
    for (const n of [1, 2, 5]) expect(html).toContain(`>${n}</button>`);
    expect(html).not.toContain("\u3010");
  });

  it("server-side contract repair never touches data numbers", () => {
    expect(normalizeCitations("asked in 9 exams, worth 8 marks", 10)).toBe(
      "asked in 9 exams, worth 8 marks",
    );
    expect(normalizeCitations("as seen in 25.", 10)).toBe("as seen in 25."); // out of ref range
    expect(normalizeCitations("released in 2024.", 10)).toBe("released in 2024.");
  });

  it("repaired transcript strings render as chips end-to-end", () => {
    const normalized = normalizeCitations(
      "This is required by 1, 2, 4, 7, and 10. It repeats often, as seen in 9.",
      10,
    );
    const html = renderSemantic(normalized, [1, 2, 4, 7, 9, 10]);
    for (const n of [1, 2, 4, 7, 9, 10]) expect(html).toContain(`>${n}</button>`);
    expect(html).not.toMatch(/required by\s*1,/);
    expect(html).not.toMatch(/seen in\s*9/);
  });

  it("real markdown links are left untouched", () => {
    const html = renderSemantic("See [the paper](https://example.com/x.pdf) [1].", [1]);
    expect(html).toContain('href="https://example.com/x.pdf"');
    expect(html).toContain(">1</button>");
  });
});
