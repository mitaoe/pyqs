import { EXAM_KEY_SQL, FILTER_SQL, type ExamFilters } from "./analytics";
import { SKIP_TAIL_MAX_EXAMS } from "./config";
import { getPool } from "./db";

export interface TopicRow {
  topic: string;
  /** Distinct exam sittings any question of this topic appeared in. */
  exam_count: number;
  /** Sum of stated marks across the topic's questions (null if never stated). */
  total_marks: number | null;
  cluster_count: number;
  /** Distinct years, ascending. */
  years: string[];
}

export interface TopicQuestion {
  text: string;
  exam_count: number;
}

/** Distinct exams with extracted questions — the denominator for "9 of 12 exams". */
export async function totalExams(subject: string, filters: ExamFilters = {}): Promise<number> {
  const res = await getPool().query(
    `SELECT COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS n
       FROM papers p
       JOIN questions q ON q.paper_id = p.id
      WHERE p.standard_subject = $1${FILTER_SQL("$2", "$3")}`,
    [subject, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows[0].n as number;
}

/**
 * Topics ranked by distinct-exam coverage, then summed marks — the
 * deterministic backbone of TOPIC_WEIGHTAGE and STUDY_GUIDE. Empty until
 * label_topics.py has run for the subject.
 */
export async function topicWeightage(
  subject: string,
  limit = 10,
  filters: ExamFilters = {},
): Promise<TopicRow[]> {
  const res = await getPool().query(
    `SELECT c.topic,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count,
            SUM(q.marks)::int AS total_marks,
            COUNT(DISTINCT c.id)::int AS cluster_count,
            array_agg(DISTINCT p.year)
              FILTER (WHERE COALESCE(p.year, '') NOT IN ('', 'Unknown')) AS years
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1
        AND c.topic IS NOT NULL${FILTER_SQL("$3", "$4")}
      GROUP BY c.topic
      ORDER BY exam_count DESC, total_marks DESC NULLS LAST, c.topic
      LIMIT $2`,
    [subject, limit, filters.year ?? null, filters.examType ?? null],
  );
  return (res.rows as (Omit<TopicRow, "years"> & { years: string[] | null })[]).map((r) => ({
    ...r,
    years: [...(r.years ?? [])].sort(),
  }));
}

/** Full-distribution stats for the glanceable strip: how many labeled
 *  topics exist and the sum of their per-topic exam appearances. */
export async function topicStats(
  subject: string,
  filters: ExamFilters = {},
): Promise<{ topic_count: number; total_appearances: number }> {
  const res = await getPool().query(
    `SELECT COUNT(*)::int AS topic_count,
            COALESCE(SUM(ec), 0)::int AS total_appearances
       FROM (
         SELECT COUNT(DISTINCT ${EXAM_KEY_SQL}) AS ec
           FROM clusters c
           JOIN questions q ON q.cluster_id = c.id
           JOIN papers p ON p.id = q.paper_id
          WHERE c.standard_subject = $1 AND c.topic IS NOT NULL${FILTER_SQL("$2", "$3")}
          GROUP BY c.topic
       ) t`,
    [subject, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows[0];
}

const TOPIC_STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "with", "using", "its",
]);

/** Lowercase, de-pluralized, stopword-free tokens for fuzzy label matching. */
export function topicTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => !TOPIC_STOPWORDS.has(t));
}

/**
 * Match a query's topic phrase against the subject's canonical labels.
 * A label matches when one token set contains the other ("doubly linked
 * list" ⊆ "Doubly Linked List Operations"). Ambiguity — several labels
 * matching equally well ("linked list" fits doubly AND circular) — returns
 * null so the embedding search can aggregate across all of them instead.
 */
export async function matchTopicLabel(subject: string, phrase: string): Promise<string | null> {
  const pt = topicTokens(phrase);
  if (pt.length === 0) return null;
  const ptSet = new Set(pt);

  const res = await getPool().query(
    "SELECT DISTINCT topic FROM clusters WHERE standard_subject = $1 AND topic IS NOT NULL",
    [subject],
  );
  const labels = (res.rows as { topic: string }[]).map((r) => r.topic);

  let best: { label: string; score: number } | null = null;
  let tied = false;
  for (const label of labels) {
    const lt = topicTokens(label);
    if (lt.length === 0) continue;
    const ltSet = new Set(lt);
    const phraseCovered = pt.every((t) => ltSet.has(t));
    const labelCovered = lt.every((t) => ptSet.has(t));
    if (!phraseCovered && !labelCovered) continue;
    const common = pt.filter((t) => ltSet.has(t)).length;
    // Coverage score with a slight penalty for extra label tokens, so an
    // exact label beats a superset label when both fully cover the phrase.
    const score = common / Math.max(pt.length, 1) - 0.01 * Math.abs(lt.length - pt.length);
    if (best === null || score > best.score) {
      best = { label, score };
      tied = false;
    } else if (Math.abs(score - best.score) < 1e-9) {
      tied = true;
    }
  }
  return best !== null && !tied ? best.label : null;
}

/** Distinct exams the LABEL's questions appeared in — identical aggregation
 *  to topicWeightage, so the figures always agree. */
export async function labelExamCount(
  subject: string,
  label: string,
  filters: ExamFilters = {},
): Promise<number> {
  const res = await getPool().query(
    `SELECT COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS n
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1 AND c.topic = $2${FILTER_SQL("$3", "$4")}`,
    [subject, label, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows[0].n as number;
}

/** The label's clusters, ranked like every other frequency list. */
export async function labelClusters(
  subject: string,
  label: string,
  limit = 10,
  filters: ExamFilters = {},
): Promise<
  {
    cluster_id: number;
    representative_text: string;
    question_count: number;
    exam_count: number;
    years_spanned: string | null;
    topic?: string | null;
    figure_share?: number;
    distinct_texts?: number;
  }[]
> {
  const res = await getPool().query(
    `SELECT c.id AS cluster_id,
            c.representative_text,
            c.question_count::int AS question_count,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count,
            AVG(CASE WHEN COALESCE(q.has_figure, false) THEN 1.0 ELSE 0 END) AS figure_share,
            COUNT(DISTINCT lower(regexp_replace(q.question_text, '\\s+', ' ', 'g')))::int AS distinct_texts,
            c.years_spanned,
            c.topic
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1 AND c.topic = $2${FILTER_SQL("$4", "$5")}
      GROUP BY c.id, c.representative_text, c.question_count, c.years_spanned, c.topic
      ORDER BY exam_count DESC, c.question_count DESC, c.id
      LIMIT $3`,
    [subject, label, limit, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows;
}

/**
 * The 1–3-exam tail of the FULL topic distribution — the only honest "you
 * can skip this" candidates. Recommendations must never come from the
 * bottom of a top-N slice, whose members still appear in many exams.
 */
export async function topicTail(subject: string, limit = 10): Promise<TopicRow[]> {
  const res = await getPool().query(
    `SELECT c.topic,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count,
            SUM(q.marks)::int AS total_marks,
            COUNT(DISTINCT c.id)::int AS cluster_count,
            array_agg(DISTINCT p.year)
              FILTER (WHERE COALESCE(p.year, '') NOT IN ('', 'Unknown')) AS years
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1
        AND c.topic IS NOT NULL
      GROUP BY c.topic
     HAVING COUNT(DISTINCT ${EXAM_KEY_SQL}) <= ${SKIP_TAIL_MAX_EXAMS}
      ORDER BY exam_count ASC, total_marks ASC NULLS FIRST, c.topic
      LIMIT $2`,
    [subject, limit],
  );
  return (res.rows as (Omit<TopicRow, "years"> & { years: string[] | null })[]).map((r) => ({
    ...r,
    years: [...(r.years ?? [])].sort(),
  }));
}

/** Up to `perTopic` example questions per topic, most-repeated first. */
export async function topicQuestions(
  subject: string,
  topics: string[],
  perTopic = 4,
  filters: ExamFilters = {},
): Promise<Map<string, TopicQuestion[]>> {
  const out = new Map<string, TopicQuestion[]>();
  if (topics.length === 0) return out;
  const res = await getPool().query(
    `SELECT c.topic,
            c.representative_text,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1
        AND c.topic = ANY($2)${FILTER_SQL("$3", "$4")}
      GROUP BY c.id, c.topic, c.representative_text
      ORDER BY exam_count DESC, c.id`,
    [subject, topics, filters.year ?? null, filters.examType ?? null],
  );
  for (const row of res.rows as { topic: string; representative_text: string; exam_count: number }[]) {
    const list = out.get(row.topic) ?? [];
    if (list.length < perTopic) {
      list.push({ text: row.representative_text, exam_count: row.exam_count });
      out.set(row.topic, list);
    }
  }
  return out;
}
