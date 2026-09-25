import { TOPIC_MATCH_THRESHOLD } from "./config";
import { getPool } from "./db";
import { toVectorLiteral } from "./vector";

export interface ClusterRow {
  cluster_id: number;
  representative_text: string;
  /** Canonical topic label, when the labeling job has covered this cluster. */
  topic?: string | null;
  /** Raw extracted-question members (may include duplicate uploads). */
  question_count: number;
  /** Distinct exam sittings the cluster's question appeared in — the honest
   *  frequency number shown to students. */
  exam_count: number;
  years_spanned: string | null;
  /** Fraction of member questions that reference a figure (0..1). */
  figure_share?: number;
  /** Distinct normalized member texts — low + many exams = text twins. */
  distinct_texts?: number;
}

/** Derived display flags: figure-dependence and text-twin annotation. */
export function annotateCluster<T extends ClusterRow>(
  c: T,
): T & { has_figure: boolean; text_twin: boolean } {
  const has_figure = (c.figure_share ?? 0) >= 0.5;
  const text_twin = has_figure && (c.distinct_texts ?? 99) <= 2 && c.exam_count >= 3;
  return { ...c, has_figure, text_twin };
}

/**
 * One exam sitting is often uploaded several times ("... (2).pdf", filename
 * typos), which would inflate every frequency count. An exam is therefore
 * identified as (standard_subject, year, exam session, exam_type, semester,
 * branch); the session month exists only inside file_name ("_APR 2024",
 * "APRIL2024", "Dec 2023"), matched as a month token directly followed by a
 * year so subject words like "Marketing" can't false-positive.
 *
 * Dedup happens at QUERY TIME rather than by migrating clusters counts:
 * stored counts stay raw, the Python pipeline needs no lock-step change, and
 * the numbers stay correct automatically after every future ingest/cluster
 * rerun. The aggregate spans a single subject's questions (~2k rows) — cheap.
 */
const EXAM_SESSION_SQL = `COALESCE(substring(upper(p.file_name) from '(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[ ._-]*[0-9]{2,4}'), '')`;

export const EXAM_KEY_SQL = `(p.standard_subject, COALESCE(p.year, ''), ${EXAM_SESSION_SQL}, COALESCE(p.exam_type, ''), COALESCE(p.semester, ''), COALESCE(p.branch, ''))`;

/** Optional year / exam-type narrowing for the frequency paths. */
export interface ExamFilters {
  year?: string | null;
  examType?: string | null;
}

// Appended to the WHERE clause of every filtered aggregate; the two extra
// parameters are always bound (NULL = no filter).
export const FILTER_SQL = (yearParam: string, examParam: string) =>
  ` AND (${yearParam}::text IS NULL OR p.year = ${yearParam})
    AND (${examParam}::text IS NULL OR UPPER(COALESCE(p.exam_type, '')) = ${examParam})`;

/** Closest year on file to a requested year — for honest-empty offers
 *  ("No 2025 papers — nearest on file is 2024"). */
export function nearestYear(years: string[], target: string): string | null {
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let best: string | null = null;
  for (const y of years) {
    const n = Number(y);
    if (!Number.isFinite(n)) continue;
    if (best === null || Math.abs(n - t) < Math.abs(Number(best) - t)) best = y;
  }
  return best;
}

/** "MSE 2024" / "2024" / "ESE" — for headings and honest-empty messages. */
export function filterLabel(filters: ExamFilters): string | null {
  const parts = [filters.examType, filters.year].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Distinct years present for a subject — shown when a year filter misses. */
export async function availableYears(subject: string): Promise<string[]> {
  const res = await getPool().query(
    `SELECT DISTINCT p.year FROM papers p
      WHERE p.standard_subject = $1 AND p.status = 'done'
        AND COALESCE(p.year, '') NOT IN ('', 'Unknown')
      ORDER BY p.year`,
    [subject],
  );
  return (res.rows as { year: string }[]).map((r) => r.year);
}

/** Distinct exams touched by any of these clusters (topic totals). */
export async function examCountForClusters(
  clusterIds: number[],
  filters: ExamFilters = {},
): Promise<number> {
  if (clusterIds.length === 0) return 0;
  const res = await getPool().query(
    `SELECT COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS n
       FROM questions q
       JOIN papers p ON p.id = q.paper_id
      WHERE q.cluster_id = ANY($1::int[])${FILTER_SQL("$2", "$3")}`,
    [clusterIds, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows[0].n as number;
}

export interface PaperSource {
  file_name: string;
  year: string | null;
  exam_type: string | null;
  url: string;
  /** Present only under an active filter: false = shown for context but
   *  outside the requested year/exam type. */
  matches_filter?: boolean;
}

/**
 * Ranked "most frequently asked" clusters for one subject — real SQL counts
 * over DISTINCT exams, never LLM guesses (see CLAUDE.md).
 */
export async function topClusters(
  subject: string,
  limit = 10,
  filters: ExamFilters = {},
): Promise<ClusterRow[]> {
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
      WHERE c.standard_subject = $1${FILTER_SQL("$3", "$4")}
      GROUP BY c.id, c.representative_text, c.question_count, c.years_spanned, c.topic
      ORDER BY exam_count DESC, c.question_count DESC, c.id
      LIMIT $2`,
    [subject, limit, filters.year ?? null, filters.examType ?? null],
  );
  return res.rows as ClusterRow[];
}

export interface TopicClusterRow extends ClusterRow {
  topic_similarity: number;
}

/**
 * TOPIC_ANALYTICS: this subject's clusters that are actually about the named
 * topic, ranked by real question_count. A cluster matches when the cosine
 * similarity between the topic-phrase embedding and the cluster's centroid
 * (average of member embeddings — the representative question is the member
 * closest to that centroid) clears TOPIC_MATCH_THRESHOLD. Subject isolation
 * stays a SQL WHERE clause, same as everywhere else.
 */
export async function topicClusters(
  subject: string,
  topicVec: number[],
  limit = 10,
  filters: ExamFilters = {},
): Promise<TopicClusterRow[]> {
  const res = await getPool().query(
    `SELECT c.id AS cluster_id,
            c.representative_text,
            c.question_count::int AS question_count,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count,
            AVG(CASE WHEN COALESCE(q.has_figure, false) THEN 1.0 ELSE 0 END) AS figure_share,
            COUNT(DISTINCT lower(regexp_replace(q.question_text, '\\s+', ' ', 'g')))::int AS distinct_texts,
            c.years_spanned,
            c.topic,
            1 - (AVG(q.embedding) <=> $1::vector) AS topic_similarity
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $2
        AND q.embedding IS NOT NULL${FILTER_SQL("$5", "$6")}
      GROUP BY c.id, c.representative_text, c.question_count, c.years_spanned, c.topic
     HAVING 1 - (AVG(q.embedding) <=> $1::vector) >= $3
      ORDER BY exam_count DESC, topic_similarity DESC, c.id
      LIMIT $4`,
    [
      toVectorLiteral(topicVec),
      subject,
      TOPIC_MATCH_THRESHOLD,
      limit,
      filters.year ?? null,
      filters.examType ?? null,
    ],
  );
  return res.rows as TopicClusterRow[];
}

export interface ClusterSourceInfo {
  /** Preview slice (newest first), capped at perCluster. */
  list: PaperSource[];
  /** TRUE total distinct source papers — labels must use this, never list.length. */
  total: number;
}

/**
 * Source papers per cluster id, newest years first. The preview is capped;
 * the true total rides along so no UI can present the slice as the whole.
 */
export async function clusterSources(
  clusterIds: number[],
  perCluster = 3,
  filters: ExamFilters = {},
): Promise<Map<number, ClusterSourceInfo>> {
  const sources = new Map<number, ClusterSourceInfo>();
  if (clusterIds.length === 0) return sources;
  const filtered = filters.year != null || filters.examType != null;

  // Under a filter, matching papers rank first and non-matching ones are
  // flagged so the UI can label them — never silently mixed in.
  const res = await getPool().query(
    `SELECT DISTINCT q.cluster_id, p.file_name, p.year, p.exam_type, p.url,
            (($2::text IS NULL OR p.year = $2)
             AND ($3::text IS NULL OR UPPER(COALESCE(p.exam_type, '')) = $3)) AS matches_filter
       FROM questions q
       JOIN papers p ON p.id = q.paper_id
      WHERE q.cluster_id = ANY($1::int[])
      ORDER BY matches_filter DESC, p.year DESC NULLS LAST, p.file_name`,
    [clusterIds, filters.year ?? null, filters.examType ?? null],
  );

  for (const row of res.rows as ({ cluster_id: number; matches_filter: boolean } & PaperSource)[]) {
    const info = sources.get(row.cluster_id) ?? { list: [], total: 0 };
    info.total++;
    if (info.list.length < perCluster) {
      info.list.push({
        file_name: row.file_name,
        year: row.year,
        exam_type: row.exam_type,
        url: row.url,
        ...(filtered ? { matches_filter: row.matches_filter } : {}),
      });
    }
    sources.set(row.cluster_id, info);
  }
  return sources;
}
