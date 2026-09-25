"""Quality gate: sample random processed papers for manual comparison.

Prints each sampled paper's extracted questions next to its PDF URL so a
human can open the PDF and verify the extraction. Run after the first ~300
papers are processed (spec), then periodically.

Usage:
    python pipeline/quality_check.py --sample 20
"""

import argparse

import db


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=20, help="papers to sample (default 20)")
    args = parser.parse_args()

    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, file_name, url, year, exam_type, standard_subject
                FROM papers WHERE status = 'done'
                ORDER BY random() LIMIT %s
                """,
                (args.sample,),
            )
            papers = cur.fetchall()

            if not papers:
                print("No processed papers yet — run the ingest first.")
                return

            for paper_id, file_name, url, year, exam_type, subject in papers:
                cur.execute(
                    "SELECT sub_label, marks, question_text FROM questions "
                    "WHERE paper_id = %s ORDER BY id",
                    (paper_id,),
                )
                questions = cur.fetchall()

                print("=" * 100)
                print(f"paper {paper_id}: {file_name}")
                print(f"  {subject} | {year} | {exam_type} | {len(questions)} questions")
                print(f"  PDF: {url}")
                print("-" * 100)
                for sub_label, marks, text in questions:
                    label = f"[{sub_label}]" if sub_label else "[--]"
                    marks_s = f"({marks} marks)" if marks is not None else "(marks n/a)"
                    print(f"  {label} {marks_s} {text}")
                print()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
