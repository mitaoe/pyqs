import { SMALL_CORPUS_EXAMS, SMALL_CORPUS_QUESTIONS } from "./config";
import { getPool } from "./db";

/** Row from subject_stats, maintained by pipeline/audit_subjects.py. */
export interface SubjectStats {
  exams: number;
  questions: number;
  clusters: number;
  distinct_years: number;
  pct_figure: number;
  text_twin_risk: number;
}

const TTL_MS = 10 * 60 * 1000;
const globalForStats = globalThis as unknown as {
  pyqStatsCache?: Map<string, { v: SubjectStats | null; exp: number }>;
};

/**
 * Cached per-subject audit stats. Null when the audit hasn't run (or the
 * table doesn't exist yet) — every consumer must degrade gracefully.
 */
export async function getSubjectStats(subject: string): Promise<SubjectStats | null> {
  globalForStats.pyqStatsCache ??= new Map();
  const hit = globalForStats.pyqStatsCache.get(subject);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v: SubjectStats | null = null;
  try {
    const res = await getPool().query(
      `SELECT exams, questions, COALESCE(clusters, 0) AS clusters, distinct_years,
              COALESCE(pct_figure, 0)::float AS pct_figure,
              COALESCE(text_twin_risk, 0)::float AS text_twin_risk
         FROM subject_stats WHERE standard_subject = $1`,
      [subject],
    );
    v = (res.rows[0] as SubjectStats | undefined) ?? null;
  } catch {
    v = null; // audit table absent — adaptive behavior simply stays off
  }
  globalForStats.pyqStatsCache.set(subject, { v, exp: Date.now() + TTL_MS });
  return v;
}

/** Small-archive check; falls back to the live exam total when unaudited. */
export function isSmallCorpus(stats: SubjectStats | null, totalExams: number | null): boolean {
  const exams = stats?.exams ?? totalExams;
  if (exams != null && exams < SMALL_CORPUS_EXAMS) return true;
  return stats != null && stats.questions < SMALL_CORPUS_QUESTIONS;
}
