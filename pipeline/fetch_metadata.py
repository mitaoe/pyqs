"""Sync paper metadata from the MITAoE PYQ API into the papers table.

Upserts by URL so re-runs are cheap and never reset the processing status of
papers that were already ingested. New papers arrive as status='pending'.
"""

import logging

import requests
from psycopg2.extras import execute_values

import config
import db

log = logging.getLogger(__name__)

UPSERT_SQL = """
INSERT INTO papers
    (file_name, url, year, branch, semester, exam_type, subject, standard_subject)
VALUES %s
ON CONFLICT (url) DO UPDATE SET
    file_name        = EXCLUDED.file_name,
    year             = EXCLUDED.year,
    branch           = EXCLUDED.branch,
    semester         = EXCLUDED.semester,
    exam_type        = EXCLUDED.exam_type,
    subject          = EXCLUDED.subject,
    standard_subject = EXCLUDED.standard_subject
"""


def fetch_papers():
    resp = requests.get(
        config.PAPERS_API_URL,
        headers={"User-Agent": config.USER_AGENT},
        timeout=config.DOWNLOAD_TIMEOUT_S,
    )
    resp.raise_for_status()
    data = resp.json()
    # Current payload nests the list under meta.papers; accept a top-level
    # list or "papers" key too in case the API evolves.
    if isinstance(data, list):
        papers = data
    else:
        papers = data.get("papers") or data.get("meta", {}).get("papers")
    if not isinstance(papers, list) or not papers:
        raise RuntimeError("could not locate papers list in API response")
    return papers


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    papers = fetch_papers()
    log.info("API returned %d papers", len(papers))

    # Dedupe by URL (ON CONFLICT cannot update the same row twice per statement).
    by_url = {}
    for p in papers:
        url = p.get("url")
        if not url or p.get("isDirectory"):
            continue
        by_url[url] = (
            p.get("fileName") or url.rsplit("/", 1)[-1],
            url,
            p.get("year"),
            p.get("branch"),
            p.get("semester"),
            p.get("examType"),
            p.get("subject"),
            p.get("standardSubject"),
        )
    rows = list(by_url.values())

    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, rows, page_size=500)
                cur.execute("SELECT status, count(*) FROM papers GROUP BY status ORDER BY status")
                counts = cur.fetchall()
        log.info("upserted %d papers; status counts: %s", len(rows), dict(counts))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
