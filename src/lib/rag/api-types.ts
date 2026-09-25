/** Response shapes of the API routes, shared by the UI and its tests. */

export interface SubjectRow {
  subject: string;
  question_count: number;
  paper_count: number;
  /** Distinct exam sittings for the subject; may be absent on older payloads. */
  exam_count?: number;
}

export interface PaperSource {
  file_name: string;
  year: string | null;
  exam_type: string | null;
  url: string;
  /** Present only under an active filter: false = outside the filter. */
  matches_filter?: boolean;
}

export interface ClusterResult {
  cluster_id: number;
  representative_text: string;
  question_count: number;
  exam_count: number;
  years_spanned: string | null;
  /** Canonical topic label, when the labeling job has covered this cluster. */
  topic?: string | null;
  /** Present only on TOPIC_ANALYTICS results. */
  topic_similarity?: number;
  /** >=50% of member questions reference a provided figure. */
  has_figure?: boolean;
  /** Near-identical text from many exams, figure-dependent — count caveat. */
  text_twin?: boolean;
  figure_share?: number;
  distinct_texts?: number;
  sources: PaperSource[];
  /** TRUE total distinct source papers (sources is a capped preview). */
  source_total?: number;
}

export interface Citation {
  ref: number;
  question_text: string;
  marks: number | null;
  sub_label: string | null;
  file_name: string;
  year: string | null;
  exam_type: string | null;
  url: string;
  standard_subject: string;
  /** Canonical topic label of the cited question's cluster, when labeled. */
  topic?: string | null;
  similarity: number;
}

export type Intent =
  | "ANALYTICS"
  | "TOPIC_ANALYTICS"
  | "TOPIC_WEIGHTAGE"
  | "YEAR_TREND"
  | "STUDY_GUIDE"
  | "SEMANTIC"
  | "REFUSED"
  | "GREETING";

export interface TrendTopicResult {
  topic: string;
  exam_count: number;
  counts: number[];
  first_year: string;
  last_year: string;
  status: "rising" | "staple" | "fading" | null;
}

export interface TopicResult {
  topic: string;
  exam_count: number;
  total_marks: number | null;
  cluster_count: number;
  years: string[];
  questions: { text: string; exam_count: number }[];
}

export interface AskResponse {
  intent: Intent;
  /** Echoed on topic-bearing responses (lazy loads need it). */
  subject?: string;
  answer: string;
  topic?: string;
  clusters?: ClusterResult[];
  citations?: Citation[];
  topics?: TopicResult[];
  total_exams?: number;
  /** TOPIC_ANALYTICS: distinct exams the topic appeared in. */
  topic_exam_count?: number;
  /** TOPIC_ANALYTICS: total distinct question groups for the topic. */
  cluster_total?: number;
  /** True when the query asked for the complete list. */
  exhaustive?: boolean;
  /** STUDY_GUIDE: the rarely-asked tail — the only honest skip candidates. */
  skip_candidates?: { topic: string; exam_count: number }[];
  /** Active year/exam-type narrowing, echoed back when set. */
  filters?: { year?: string | null; exam_type?: string | null };
  /** True when the query asked for a prediction (answer leads with disclaimer). */
  predictive?: boolean;
  /** Small archive: tiers/percentages suppressed, caveats shown. */
  small_corpus?: boolean;
  /** YEAR_TREND: per-year distinct-exam counts by topic. */
  trend?: { years: string[]; topics: TrendTopicResult[] };
  /** Total labeled topics for the subject (stat strip). */
  topic_count?: number;
  /** Sum of per-topic exam appearances (stat-strip share denominator). */
  total_appearances?: number;
  /** True when served from the response cache. */
  cached?: boolean;
  /** True when retrieval couldn't support an answer (honest no-answer path). */
  no_answer?: boolean;
  /** True when Gemini quota is exhausted and raw retrieval was returned. */
  degraded?: boolean;
}

export interface StatsResponse {
  papers: Record<string, number>;
  questions: { total: number; embedded: number; clustered: number };
  clusters: number;
  subjects: SubjectRow[];
}

/** "2019,2020,2023" -> "2019–2023"; single year stays as-is. */
export function yearSpan(yearsSpanned: string | null): string | null {
  if (!yearsSpanned) return null;
  const years = yearsSpanned
    .split(",")
    .map((y) => y.trim())
    .filter(Boolean);
  if (years.length === 0) return null;
  if (years.length === 1) return years[0];
  return `${years[0]}–${years[years.length - 1]}`;
}
