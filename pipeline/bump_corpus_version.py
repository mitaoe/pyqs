"""Bump corpus_version and sweep the response cache.

Runs as the LAST step of the ingest workflow, after questions, embeddings,
clusters and topic labels have all settled. Everything the runtime cached on
a deterministic path ("asked in 30 of 49 exams") was computed against the old
corpus and is now potentially wrong, so bumping the counter retires all of it
at once — the runtime compares the stored version on read and treats a
mismatch as a miss.

Semantic (LLM-written) entries are left alone: they expire on their own TTL.
Their prose does not quote exact counts, so a newly ingested paper does not
falsify them the way it falsifies a ranking.

Idempotent and safe to run when nothing changed — a bump only ever costs the
next student one uncached answer.
"""

import logging

import db

log = logging.getLogger(__name__)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                # The table is created by schema.sql; seed defensively so this
                # step also works against a database that predates it.
                cur.execute(
                    "INSERT INTO corpus_version (id, version) VALUES (1, 1) "
                    "ON CONFLICT (id) DO NOTHING"
                )
                cur.execute(
                    "UPDATE corpus_version SET version = version + 1, updated_at = now() "
                    "WHERE id = 1 RETURNING version"
                )
                version = cur.fetchone()[0]
                log.info("corpus_version bumped to %d", version)

                # Rows the bump just retired can never be read again — drop
                # them so the table stays small on the free tier.
                cur.execute(
                    "DELETE FROM response_cache "
                    "WHERE (deterministic AND corpus_version < %s) OR expires_at <= now()",
                    (version,),
                )
                log.info("swept %d stale response_cache rows", cur.rowcount)

                cur.execute("SELECT count(*) FROM response_cache")
                log.info("response_cache now holds %d rows", cur.fetchone()[0])
    finally:
        conn.close()


if __name__ == "__main__":
    main()
