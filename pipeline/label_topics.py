"""Assign canonical topic names to clusters via Gemini, then merge
near-duplicate labels per subject by embedding similarity.

Resumable: only clusters WHERE topic IS NULL are labeled; progress lives in
the DB. Uses the ingestion KeyManager pool (never the reserved runtime key).
When all pool keys are exhausted the run exits cleanly — cron resumes later.

Usage:
    python pipeline/label_topics.py                       # label everything pending
    python pipeline/label_topics.py --limit 500           # bounded run
    python pipeline/label_topics.py --subjects "A,B"      # specific subjects
    python pipeline/label_topics.py --skip-normalize      # skip the merge phase
    python pipeline/label_topics.py --normalize-all       # re-merge every subject
"""

import argparse
import logging
import sys

from psycopg2.extras import execute_values

import config
import db
from gemini import GeminiError, ModelUnusable, label_cluster_topics, preflight
from key_manager import AllKeysExhausted, KeyManager

log = logging.getLogger("label_topics")


def fetch_unlabeled(conn, subjects, limit):
    sql = """SELECT id, standard_subject, representative_text
               FROM clusters WHERE topic IS NULL"""
    params = []
    if subjects:
        sql += " AND standard_subject = ANY(%s)"
        params.append(subjects)
    sql += " ORDER BY standard_subject, question_count DESC, id"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def save_labels(conn, labels):
    if not labels:
        return
    with conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """UPDATE clusters AS c SET topic = v.topic
                     FROM (VALUES %s) AS v(id, topic) WHERE c.id = v.id""",
                list(labels.items()),
            )


def label_phase(conn, km, subjects, limit):
    """Label pending clusters in batches. Returns the set of touched subjects."""
    touched = set()
    labeled = 0
    while True:
        remaining = None if limit is None else max(limit - labeled, 0)
        if remaining == 0:
            break
        rows = fetch_unlabeled(conn, subjects, min(config.TOPIC_LABEL_BATCH, remaining or config.TOPIC_LABEL_BATCH))
        if not rows:
            break
        items = [(cid, text) for cid, _subj, text in rows]
        try:
            labels = label_cluster_topics(km, items)
        except GeminiError as exc:
            # A batch Gemini can't produce JSON for shouldn't kill the run;
            # its clusters stay NULL and are retried next run.
            log.error("batch failed permanently, skipping %d clusters: %s", len(items), exc)
            # Avoid an infinite loop on the same failing batch this run.
            break
        save_labels(conn, labels)
        labeled += len(labels)
        touched.update(subj for _cid, subj, _t in rows)
        log.info("progress: %d clusters labeled this run", labeled)
    return touched


def _greedy_merge(topics, weights, vectors):
    """Map near-duplicate labels to the highest-weight canonical label.

    Greedy by weight: heavier labels become canonical; a lighter label whose
    embedding is within TOPIC_MERGE_THRESHOLD of an already-kept canonical is
    merged into it. Deterministic and idempotent.
    """
    import numpy as np

    order = sorted(range(len(topics)), key=lambda i: (-weights[i], topics[i]))
    kept = []
    mapping = {}
    for i in order:
        if kept:
            sims = np.array([float(np.dot(vectors[i], vectors[j])) for j in kept])
            best = int(sims.argmax())
            if sims[best] >= config.TOPIC_MERGE_THRESHOLD:
                mapping[topics[i]] = topics[kept[best]]
                continue
        kept.append(i)
    return mapping


def normalize_subject(conn, subject, model):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT topic, SUM(question_count)::int AS weight
                 FROM clusters WHERE standard_subject = %s AND topic IS NOT NULL
                GROUP BY topic""",
            (subject,),
        )
        rows = cur.fetchall()
    if len(rows) < 2:
        return 0
    topics = [r[0] for r in rows]
    weights = [r[1] for r in rows]
    vectors = model.encode(topics, normalize_embeddings=True, show_progress_bar=False)
    mapping = _greedy_merge(topics, weights, vectors)
    if not mapping:
        return 0
    with conn:
        with conn.cursor() as cur:
            for src, dst in mapping.items():
                cur.execute(
                    "UPDATE clusters SET topic = %s WHERE standard_subject = %s AND topic = %s",
                    (dst, subject, src),
                )
    log.info("normalized %s: merged %d label variants", subject, len(mapping))
    return len(mapping)


def normalize_phase(conn, subjects):
    # Imported lazily: the label phase must run even where torch isn't installed.
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(config.EMBED_MODEL, device="cpu")
    merged = 0
    for subject in sorted(subjects):
        merged += normalize_subject(conn, subject, model)
    log.info("normalization done: %d labels merged across %d subjects", merged, len(subjects))


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="max clusters to label this run")
    parser.add_argument("--subjects", type=str, default=None, help="comma-separated subject filter")
    parser.add_argument("--skip-normalize", action="store_true", help="skip the label-merge phase")
    parser.add_argument(
        "--normalize-all", action="store_true", help="re-merge every labeled subject, not just touched ones"
    )
    args = parser.parse_args()
    subjects = [s.strip() for s in args.subjects.split(",")] if args.subjects else None

    km = KeyManager()
    try:
        preflight(km)
    except AllKeysExhausted as exc:
        log.warning("preflight: %s — exiting cleanly", exc)
        return
    except (ModelUnusable, GeminiError) as exc:
        log.error("preflight failed: %s", exc)
        sys.exit(1)

    conn = db.get_conn()
    try:
        try:
            touched = label_phase(conn, km, subjects, args.limit)
        except AllKeysExhausted as exc:
            log.warning("stopping cleanly: %s", exc)
            touched = set()
        except ModelUnusable as exc:
            log.error("aborting run: %s", exc)
            sys.exit(1)

        if args.normalize_all:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT standard_subject FROM clusters WHERE topic IS NOT NULL")
                touched = {r[0] for r in cur.fetchall()}
        if args.skip_normalize:
            log.info("skipping normalization (%d subjects touched)", len(touched))
        elif touched:
            normalize_phase(conn, touched)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
