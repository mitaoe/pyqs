import { EXAM_KEY_SQL } from "./analytics";
import { getPool } from "./db";

export interface SubjectRow {
  subject: string;
  question_count: number;
  paper_count: number;
  /** Distinct exam sittings (duplicate uploads of one sitting collapse to 1). */
  exam_count: number;
}

export async function listSubjects(): Promise<SubjectRow[]> {
  const res = await getPool().query(
    `SELECT p.standard_subject AS subject,
            COUNT(q.id)::int AS question_count,
            COUNT(DISTINCT p.id)::int AS paper_count,
            COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count
       FROM papers p
       JOIN questions q ON q.paper_id = p.id
      WHERE p.status = 'done'
        AND COALESCE(p.standard_subject, '') <> ''
      GROUP BY p.standard_subject
      ORDER BY p.standard_subject`,
  );
  return res.rows as SubjectRow[];
}

export async function subjectExists(subject: string): Promise<boolean> {
  const res = await getPool().query(
    "SELECT 1 FROM papers WHERE standard_subject = $1 LIMIT 1",
    [subject],
  );
  return (res.rowCount ?? 0) > 0;
}
