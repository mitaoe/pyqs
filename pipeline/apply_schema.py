"""Apply schema.sql to the database. Idempotent; runs at pipeline start."""

import logging
import pathlib

import db

log = logging.getLogger(__name__)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sql = (pathlib.Path(__file__).parent / "schema.sql").read_text()
    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
        log.info("schema applied")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
