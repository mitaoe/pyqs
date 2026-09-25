"""Cluster questions by embedding similarity, per standard_subject.

Agglomerative clustering (average linkage) with a cosine-similarity
threshold of CLUSTER_COSINE_THRESHOLD groups repeated/near-identical
questions so analytics queries can report REAL counts. Each affected
subject is rebuilt atomically: its clusters rows are replaced and every
question's cluster_id is reassigned in one transaction.

By default only subjects that gained new embedded questions since the last
run are reclustered; --all forces a full rebuild (e.g. after changing the
threshold).
"""

import argparse
import json
import logging

import numpy as np
from psycopg2.extras import execute_values
from sklearn.cluster import AgglomerativeClustering

import config
import db

log = logging.getLogger("cluster")


def subjects_to_recluster(conn, recluster_all):
    where = "" if recluster_all else "AND q.cluster_id IS NULL"
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT DISTINCT p.standard_subject
            FROM questions q
            JOIN papers p ON p.id = q.paper_id
            WHERE q.embedding IS NOT NULL
              AND p.standard_subject IS NOT NULL AND p.standard_subject <> ''
              {where}
            ORDER BY p.standard_subject
        """)
        return [r[0] for r in cur.fetchall()]


def load_subject_questions(conn, subject):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT q.id, q.question_text, q.embedding::text, q.paper_id, p.year
            FROM questions q
            JOIN papers p ON p.id = q.paper_id
            WHERE p.standard_subject = %s AND q.embedding IS NOT NULL
            ORDER BY q.id
        """, (subject,))
        return cur.fetchall()


def assign_labels(embeddings, threshold):
    if len(embeddings) == 1:
        return np.zeros(1, dtype=int)
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=1.0 - threshold,
        metric="cosine",
        linkage="average",
    )
    return clustering.fit_predict(embeddings)


def rebuild_subject(conn, subject):
    threshold = config.CLUSTER_THRESHOLD_OVERRIDES.get(subject, config.CLUSTER_COSINE_THRESHOLD)
    rows = load_subject_questions(conn, subject)
    if not rows:
        return 0

    if len(rows) > config.MAX_CLUSTER_SUBJECT_SIZE:
        # Agglomerative clustering is O(n^2) in memory; refuse rather than
        # OOM the runner. Revisit with MiniBatchKMeans if this ever triggers.
        log.error("skipping %r: %d questions exceeds MAX_CLUSTER_SUBJECT_SIZE", subject, len(rows))
        return 0

    X = np.array([json.loads(emb) for _, _, emb, _, _ in rows], dtype=np.float32)
    # Normalize so cosine math is dot products (embeddings are stored
    # normalized, but don't depend on it).
    X /= np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-12)
    labels = assign_labels(X, threshold)

    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM clusters WHERE standard_subject = %s", (subject,))
            assignments = []
            for label in np.unique(labels):
                idx = np.where(labels == label)[0]
                centroid = X[idx].mean(axis=0)
                rep_i = idx[np.argmax(X[idx] @ centroid)]
                years = sorted({str(rows[i][4]) for i in idx if rows[i][4]})
                cur.execute(
                    """
                    INSERT INTO clusters
                        (standard_subject, representative_text, question_count,
                         papers_count, years_spanned)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        subject,
                        rows[rep_i][1],
                        len(idx),
                        len({rows[i][3] for i in idx}),
                        ",".join(years),
                    ),
                )
                cluster_id = cur.fetchone()[0]
                assignments.extend((rows[i][0], cluster_id) for i in idx)
            execute_values(
                cur,
                "UPDATE questions AS q SET cluster_id = v.cid "
                "FROM (VALUES %s) AS v(id, cid) WHERE q.id = v.id",
                assignments,
            )
    n_clusters = len(np.unique(labels))
    log.info("%r: %d questions -> %d clusters", subject, len(rows), n_clusters)
    return n_clusters


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subjects", type=str, default=None,
                        help="comma-separated subjects to force-recluster (e.g. after a threshold override)")
    parser.add_argument("--all", action="store_true",
                        help="recluster every subject, not just ones with new questions")
    args = parser.parse_args()

    conn = db.get_conn()
    try:
        if args.subjects:
            subjects = [x.strip() for x in args.subjects.split(",") if x.strip()]
        else:
            subjects = subjects_to_recluster(conn, args.all)
        log.info("%d subject(s) to (re)cluster", len(subjects))
        for subject in subjects:
            rebuild_subject(conn, subject)
    finally:
        conn.close()
    log.info("clustering complete")


if __name__ == "__main__":
    main()
