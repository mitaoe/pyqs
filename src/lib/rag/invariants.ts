/**
 * Machine-checkable response invariants (see CLAUDE.md "Response
 * invariants") — the final gate every /api/ask response passes before the
 * client sees it. Violations on deterministic paths are BUGS: they are
 * logged loudly (evt: invariant_violation) so the source gets fixed; the
 * response is still served (availability first). LLM paths have their own
 * reject/retry upstream — this layer catches residuals.
 */

import { SKIP_TAIL_MAX_EXAMS } from "./config";
import { isSmallCorpus, type SubjectStats } from "./subject-stats";

// Known internal names only — a generic <tag> pattern would false-flag
// legitimate content like "vector<int>" in CS answers.
const INTERNAL_VOCAB =
  /topic_weightage_data|rarely_asked_topics|retrieved_questions|student_question|<\/?(?:topic_weightage_data|rarely_asked_topics|retrieved_questions|student_question|conversation)>/i;

const ANALYTIC_INTENTS = new Set(["ANALYTICS", "TOPIC_ANALYTICS", "TOPIC_WEIGHTAGE", "YEAR_TREND"]);

export interface InvariantViolation {
  invariant: string;
  detail: string;
}

interface ResponseShape {
  intent?: string;
  answer?: string;
  total_exams?: number;
  topic_exam_count?: number;
  cluster_total?: number;
  topic_count?: number;
  exhaustive?: boolean;
  small_corpus?: boolean;
  filters?: unknown;
  clusters?: { exam_count: number; sources?: unknown[]; source_total?: number }[];
  topics?: { exam_count: number; cluster_count?: number; questions?: unknown[] }[];
  skip_candidates?: { topic: string; exam_count: number }[];
}

export function checkResponseInvariants(
  body: ResponseShape,
  ctx: { stats: SubjectStats | null; filtersActive: boolean },
): InvariantViolation[] {
  const v: InvariantViolation[] = [];
  const answer = String(body.answer ?? "");
  const intent = body.intent ?? "";

  // Non-empty answer, no internal vocabulary — applies to everything.
  if (answer.trim().length === 0) v.push({ invariant: "non-empty", detail: "empty answer" });
  if (INTERNAL_VOCAB.test(answer)) {
    v.push({ invariant: "no-internal-vocab", detail: "internal names in answer" });
  }

  // Denominator integrity.
  const total = body.total_exams;
  if (total != null) {
    for (const c of body.clusters ?? []) {
      if (c.exam_count > total) {
        v.push({ invariant: "denominator", detail: `cluster ${c.exam_count} > ${total}` });
      }
    }
    for (const t of body.topics ?? []) {
      if (t.exam_count > total) {
        v.push({ invariant: "denominator", detail: `topic ${t.exam_count} > ${total}` });
      }
    }
    if (body.topic_exam_count != null && body.topic_exam_count > total) {
      v.push({ invariant: "denominator", detail: `topic_exam_count ${body.topic_exam_count} > ${total}` });
    }
  }

  // Nested totals are true totals, never preview lengths.
  for (const t of body.topics ?? []) {
    if (t.cluster_count != null && (t.questions?.length ?? 0) > t.cluster_count) {
      v.push({ invariant: "nested-totals", detail: "preview longer than cluster_count" });
    }
  }
  for (const c of body.clusters ?? []) {
    if (c.source_total != null && (c.sources?.length ?? 0) > c.source_total) {
      v.push({ invariant: "nested-totals", detail: "source preview longer than total" });
    }
  }

  // Scope fidelity: capped lists must state their scope in the answer.
  if (
    intent === "TOPIC_ANALYTICS" &&
    !body.exhaustive &&
    body.cluster_total != null &&
    (body.clusters?.length ?? 0) < body.cluster_total &&
    !/Showing top \d+ of \d+/i.test(answer)
  ) {
    v.push({ invariant: "scope-fidelity", detail: "capped topic list without scope statement" });
  }
  if (
    intent === "TOPIC_WEIGHTAGE" &&
    body.topic_count != null &&
    (body.topics?.length ?? 0) > 0 &&
    (body.topics?.length ?? 0) < body.topic_count && // more topics exist than shown
    !/Top \d+ of \d+/i.test(answer)
  ) {
    v.push({ invariant: "scope-fidelity", detail: "capped weightage without scope statement" });
  }

  // Filter propagation: analytic responses under a filter must echo it.
  if (ctx.filtersActive && ANALYTIC_INTENTS.has(intent) && body.filters == null) {
    v.push({ invariant: "filter-propagation", detail: "active filter not echoed" });
  }

  // Skip safety.
  for (const t of body.skip_candidates ?? []) {
    if (t.exam_count > SKIP_TAIL_MAX_EXAMS) {
      v.push({ invariant: "skip-safety", detail: `candidate "${t.topic}" has ${t.exam_count} exams` });
    }
  }
  if ((body.skip_candidates?.length ?? 0) > 0 && !/not skippable/i.test(answer)) {
    v.push({ invariant: "skip-safety", detail: 'skip response missing "not skippable"' });
  }

  // Small-corpus humility (analytic + study paths).
  if (
    ctx.stats != null &&
    isSmallCorpus(ctx.stats, body.total_exams ?? null) &&
    (ANALYTIC_INTENTS.has(intent) || intent === "STUDY_GUIDE") &&
    (body.clusters?.length ?? 0) + (body.topics?.length ?? 0) > 0
  ) {
    if (body.small_corpus !== true) {
      v.push({ invariant: "small-corpus", detail: "small_corpus flag missing" });
    }
    if (!/small archive/i.test(answer)) {
      v.push({ invariant: "small-corpus", detail: "small-archive caveat missing" });
    }
  }

  return v;
}
