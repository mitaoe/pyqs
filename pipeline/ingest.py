"""Main ingestion loop: pending papers -> questions in Postgres.

Streaming, one paper at a time: download PDF -> extract text (OCR fallback)
-> Gemini question extraction -> save questions -> DELETE the PDF -> next.
PDFs are never stored. Progress lives in papers.status, so the run is
resumable and idempotent: a re-run only touches pending papers.

One bad paper never crashes the run (it is marked failed with the error).
When every pool key is rate-limited/exhausted the run exits cleanly with
code 0 — the cron re-run resumes the backlog.

Usage:
    python pipeline/ingest.py --limit 300     # normal batch
    python pipeline/ingest.py --limit 5      # smoke test
"""

import argparse
import logging
import os
import sys
import tempfile
import time

import requests
from psycopg2.extras import execute_values

import config
import db
from extract_text import extract_text
from gemini import GeminiError, ModelUnusable, extract_questions, preflight
from key_manager import AllKeysExhausted, KeyManager

log = logging.getLogger("ingest")


def download_pdf(url, dest_path):
    with requests.get(
        url,
        stream=True,
        timeout=config.DOWNLOAD_TIMEOUT_S,
        headers={"User-Agent": config.USER_AGENT},
    ) as resp:
        resp.raise_for_status()
        size = 0
        with open(dest_path, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=64 * 1024):
                size += len(chunk)
                if size > config.MAX_PDF_BYTES:
                    raise RuntimeError(f"PDF exceeds {config.MAX_PDF_BYTES} bytes")
                fh.write(chunk)
    return size


def save_questions(conn, paper_id, questions):
    """Replace this paper's questions and mark it done, atomically."""
    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM questions WHERE paper_id = %s", (paper_id,))
            execute_values(
                cur,
                "INSERT INTO questions (paper_id, question_text, marks, sub_label) VALUES %s",
                [(paper_id, q["question_text"], q["marks"], q["sub_label"]) for q in questions],
            )
            cur.execute(
                "UPDATE papers SET status = 'done', error = NULL WHERE id = %s", (paper_id,)
            )


def save_extract_method(conn, paper_id, method):
    with conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE papers SET extract_method = %s WHERE id = %s", (method, paper_id))


def mark_failed(conn, paper_id, error):
    conn.rollback()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE papers SET status = 'failed', error = %s WHERE id = %s",
                (str(error)[:500], paper_id),
            )


def process_paper(conn, km, paper, workdir):
    paper_id, url, file_name = paper
    pdf_path = os.path.join(workdir, f"paper-{paper_id}.pdf")
    try:
        size = download_pdf(url, pdf_path)
        text, method = extract_text(pdf_path)
    finally:
        # Never keep the PDF, even on failure.
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

    if len(text.strip()) < config.MIN_TEXT_CHARS:
        raise RuntimeError("no extractable text even after OCR")

    questions = extract_questions(km, text)
    if not questions:
        raise RuntimeError("Gemini returned zero questions")

    save_questions(conn, paper_id, questions)
    save_extract_method(conn, paper_id, method)
    log.info(
        "paper %d done: %s (%d KB, %s, %d questions)",
        paper_id, file_name, size // 1024, method, len(questions),
    )


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=config.DEFAULT_BATCH_LIMIT,
        help=f"max papers to process this run (default {config.DEFAULT_BATCH_LIMIT}; use 5 for a smoke test)",
    )
    args = parser.parse_args()

    km = KeyManager()
    try:
        preflight(km)
    except AllKeysExhausted as exc:
        # Nothing wrong with the model; quotas are just spent. Exit cleanly
        # so the next cron run resumes.
        log.warning("preflight: %s — exiting cleanly", exc)
        return
    except (ModelUnusable, GeminiError) as exc:
        log.error("preflight failed: %s", exc)
        sys.exit(1)

    conn = db.get_conn()
    done = failed = 0
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, url, file_name FROM papers WHERE status = 'pending' ORDER BY id LIMIT %s",
                (args.limit,),
            )
            pending = cur.fetchall()
        log.info("processing %d pending papers (limit %d)", len(pending), args.limit)

        with tempfile.TemporaryDirectory(prefix="pyq-ingest-") as workdir:
            for paper in pending:
                try:
                    process_paper(conn, km, paper, workdir)
                    done += 1
                except AllKeysExhausted as exc:
                    log.warning("stopping cleanly: %s", exc)
                    break
                except ModelUnusable as exc:
                    # Retired or removed model: no key rotation can help.
                    # Fail the job loudly so the workflow run goes red.
                    log.error("aborting run: %s", exc)
                    sys.exit(1)
                except Exception as exc:  # noqa: BLE001 — one bad paper never crashes the run
                    failed += 1
                    log.error("paper %d failed: %s", paper[0], exc)
                    mark_failed(conn, paper[0], exc)
                # Politeness to the PDF host (spec: <=2 concurrent; we run sequentially).
                time.sleep(config.DOWNLOAD_DELAY_S)
    finally:
        conn.close()

    log.info("run finished: %d done, %d failed, %d selected", done, failed, len(pending))


if __name__ == "__main__":
    main()
