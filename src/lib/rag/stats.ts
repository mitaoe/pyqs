import { getPool } from "./db";
import { listSubjects, type SubjectRow } from "./subjects";

export interface Stats {
  papers: Record<string, number>; // status -> count (pending/done/failed)
  questions: { total: number; embedded: number; clustered: number };
  clusters: number;
  subjects: SubjectRow[];
  recent_failures: { file_name: string; error: string | null }[];
}

export async function getStats(): Promise<Stats> {
  const pool = getPool();
  const [papersRes, questionsRes, clustersRes, failuresRes, subjects] = await Promise.all([
    pool.query("SELECT status, COUNT(*)::int AS count FROM papers GROUP BY status"),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(embedding)::int AS embedded,
              COUNT(cluster_id)::int AS clustered
         FROM questions`,
    ),
    pool.query("SELECT COUNT(*)::int AS count FROM clusters"),
    pool.query(
      "SELECT file_name, error FROM papers WHERE status = 'failed' ORDER BY id DESC LIMIT 10",
    ),
    listSubjects(),
  ]);

  const papers: Record<string, number> = {};
  for (const row of papersRes.rows as { status: string; count: number }[]) {
    papers[row.status] = row.count;
  }

  return {
    papers,
    questions: questionsRes.rows[0],
    clusters: clustersRes.rows[0].count,
    subjects,
    recent_failures: failuresRes.rows,
  };
}
