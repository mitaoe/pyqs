import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AskAiPanelBody,
  resolveSubject,
  nearestSubjects,
} from "../src/components/assistant/AskAiPanel";
import type { SubjectRow } from "../src/lib/rag/api-types";

const SUBJECTS: SubjectRow[] = [
  { subject: "Advanced Analysis", question_count: 36, paper_count: 6 },
  { subject: "Applied Mathematics", question_count: 402, paper_count: 67 },
  { subject: "Data Structures", question_count: 200, paper_count: 30 },
];

type BodyProps = Parameters<typeof AskAiPanelBody>[0];

function renderBody(overrides: Partial<BodyProps>): string {
  const props: BodyProps = {
    subjects: SUBJECTS,
    loadError: null,
    mode: "browse",
    browsedSubject: null,
    effectiveSubject: null,
    questionCount: null,
    nearest: [],
    switchNotice: null,
    chatEpoch: 0,
    onRetry: () => {},
    onPick: () => {},
    onChangeSubject: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(<AskAiPanelBody {...props} />);
}

describe("resolveSubject — exact, case-insensitive, never fuzzy", () => {
  it("resolves an exact browsed name to the canonical subject", () => {
    expect(resolveSubject("Advanced Analysis", SUBJECTS)).toBe("Advanced Analysis");
  });

  it("matches case-insensitively and trims, returning the canonical casing", () => {
    expect(resolveSubject("advanced analysis", SUBJECTS)).toBe("Advanced Analysis");
    expect(resolveSubject("  data structures ", SUBJECTS)).toBe("Data Structures");
  });

  it("returns null for a near-but-different name (no silent substitution)", () => {
    expect(resolveSubject("Advanced Analytics", SUBJECTS)).toBeNull();
    expect(resolveSubject("", SUBJECTS)).toBeNull();
  });
});

describe("nearestSubjects — seam candidates", () => {
  it("surfaces the closest real subjects by shared words", () => {
    const near = nearestSubjects("Advanced Analytics", SUBJECTS, 3);
    expect(near).toContain("Advanced Analysis");
    expect(near.length).toBeLessThanOrEqual(3);
  });
});

describe("AskAiPanelBody — subject follows the browsed subject", () => {
  it("binds the chat to the browsed subject (Advanced Analysis)", () => {
    const html = renderBody({
      browsedSubject: "Advanced Analysis",
      effectiveSubject: "Advanced Analysis",
      questionCount: 36,
    });
    // Chat empty-state + input reference the bound subject.
    expect(html).toContain("Advanced Analysis");
    // Never the leaked / any other subject, and no mismatch/picker.
    expect(html).not.toContain("Applied Mathematics");
    expect(html).not.toContain("data-testid=\"subject-mismatch\"");
    expect(html).not.toContain("Search your subject");
  });

  it("re-binds to a different subject on navigation (Data Structures)", () => {
    const html = renderBody({
      browsedSubject: "Data Structures",
      effectiveSubject: "Data Structures",
      questionCount: 200,
    });
    expect(html).toContain("Data Structures");
    expect(html).not.toContain("Advanced Analysis");
  });

  it("shows a 'switched to' notice when the subject changes", () => {
    const html = renderBody({
      browsedSubject: "Data Structures",
      effectiveSubject: "Data Structures",
      switchNotice: "Data Structures",
    });
    expect(html).toContain("switch-notice");
    expect(html).toContain("Switched to Data Structures");
  });
});

describe("AskAiPanelBody — honest mismatch state", () => {
  it("shows the no-data state (never substitutes) for an unknown browsed subject", () => {
    const html = renderBody({
      browsedSubject: "Advanced Analytics", // not in the corpus
      effectiveSubject: null,
      nearest: ["Advanced Analysis"],
    });
    expect(html).toContain("data-testid=\"subject-mismatch\"");
    expect(html).toContain("available for"); // "AI data isn't available for ..."
    expect(html).toContain("Advanced Analytics"); // the actual browsed name, verbatim
    expect(html).toContain("href=\"/assistant\""); // link to the browse-all page
    // Scope fidelity: no chat, no substituted subject.
    expect(html).not.toContain("Ask about"); // Chat input placeholder is absent
    expect(html).not.toContain("Applied Mathematics");
    // Closest-available hint.
    expect(html).toContain("Advanced Analysis");
  });
});

describe("AskAiPanelBody — free mode + loading/error", () => {
  it("offers the picker off browse pages (free mode, no localStorage)", () => {
    const html = renderBody({ mode: "free", browsedSubject: null });
    expect(html).toContain("Pick a subject to ask about");
    expect(html).toContain("Search your subject");
    expect(html).not.toContain("data-testid=\"subject-mismatch\"");
  });

  it("renders the retry affordance on a load error", () => {
    const html = renderBody({ subjects: null, loadError: "boom" });
    expect(html).toContain("Retry");
    expect(html).toContain("boom");
  });
});
