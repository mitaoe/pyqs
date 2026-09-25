"""Embed questions that don't have embeddings yet.

Runs sentence-transformers all-MiniLM-L6-v2 on CPU (in GitHub Actions) and
stores normalized 384-dim vectors in the pgvector column. Batched and
resumable: it simply loops until no NULL-embedding questions remain.
"""

import logging

from psycopg2.extras import execute_values

import config
import db

log = logging.getLogger("embed")


def vector_literal(vec):
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM questions WHERE embedding IS NULL")
            todo = cur.fetchone()[0]
        if todo == 0:
            log.info("nothing to embed")
            return
        log.info("%d questions need embeddings", todo)

        # Import here so runs with no work never pay the torch startup cost.
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(config.EMBED_MODEL, device="cpu")

        embedded = 0
        while True:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, question_text FROM questions "
                    "WHERE embedding IS NULL ORDER BY id LIMIT %s",
                    (config.EMBED_BATCH_SIZE,),
                )
                rows = cur.fetchall()
            if not rows:
                break

            vectors = model.encode(
                [text for _, text in rows],
                batch_size=64,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            with conn:
                with conn.cursor() as cur:
                    execute_values(
                        cur,
                        "UPDATE questions AS q SET embedding = v.emb::vector "
                        "FROM (VALUES %s) AS v(id, emb) WHERE q.id = v.id",
                        [(qid, vector_literal(vec)) for (qid, _), vec in zip(rows, vectors)],
                    )
            embedded += len(rows)
            log.info("embedded %d/%d", embedded, todo)

        log.info("done: %d questions embedded", embedded)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
