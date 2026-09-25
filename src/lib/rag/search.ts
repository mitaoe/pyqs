import { getPool } from "./db";
import { toVectorLiteral } from "./vector";

export interface SearchHit {
  question_id: number;
  question_text: string;
  marks: number | null;
  sub_label: string | null;
  file_name: string;
  year: string | null;
  exam_type: string | null;
  url: string;
  standard_subject: string;
  /** Canonical topic label of the hit's cluster, when labeled. */
  topic: string | null;
  similarity: number;
}

/**
 * Subject-scoped pgvector similarity search returning k DISTINCT questions.
 *
 * Subject isolation is the WHERE clause on papers.standard_subject — SQL,
 * applied before vector ordering, never left to the LLM (see CLAUDE.md).
 *
 * The corpus contains many verbatim duplicates (the same exam uploaded
 * multiple times, and questions legitimately repeated across exams), so the
 * top-k is deduplicated on whitespace/case-normalized question_text — the
 * synthesis context gets k different questions, not one question k times.
 * DISTINCT ON forgoes the ANN index, but the subject filter bounds the scan
 * to a few thousand rows, which Postgres handles in milliseconds.
 */
export async function semanticSearch(
  subject: string,
  queryVec: number[],
  limit = 10,
): Promise<SearchHit[]> {
  const res = await getPool().query(
    `SELECT question_id, question_text, marks, sub_label,
            file_name, year, exam_type, url, standard_subject, topic, similarity
       FROM (
         SELECT DISTINCT ON (norm_text) *
           FROM (
             SELECT q.id AS question_id,
                    q.question_text,
                    q.marks,
                    q.sub_label,
                    p.file_name,
                    p.year,
                    p.exam_type,
                    p.url,
                    p.standard_subject,
                    cl.topic,
                    1 - (q.embedding <=> $1::vector) AS similarity,
                    lower(regexp_replace(q.question_text, '\\s+', ' ', 'g')) AS norm_text
               FROM questions q
               JOIN papers p ON p.id = q.paper_id
               LEFT JOIN clusters cl ON cl.id = q.cluster_id
              WHERE p.standard_subject = $2
                AND q.embedding IS NOT NULL
           ) scored
          ORDER BY norm_text, similarity DESC
       ) deduped
      ORDER BY similarity DESC
      LIMIT $3`,
    [toVectorLiteral(queryVec), subject, limit],
  );
  return res.rows as SearchHit[];
}
