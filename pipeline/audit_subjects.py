"""Per-subject corpus health audit -> subject_stats table + ranked report.

Computes, for every subject: papers/exams/questions/clusters, labeling
coverage, year distribution, OCR share (only for papers ingested after
extract_method tracking landed — NULL elsewhere), figure-dependence share,
largest-cluster shape, and a text-twin risk score (clusters whose members
are near-identical text from >=3 exams and figure-dependent — the signature
of "same words, different figure" over-merges).

Backfills questions.has_figure (regex) before computing. Idempotent; safe
to re-run any time. No Gemini, no downloads — pure SQL.

Usage:
    python pipeline/audit_subjects.py            # audit + report
    python pipeline/audit_subjects.py --top 10   # rows per report category
"""

import argparse
import json
import logging

import db

log = logging.getLogger("audit")

# Mirrors EXAM_KEY_SQL in lib/analytics.ts — keep in sync.
EXAM_SESSION_SQL = (
    "COALESCE(substring(upper(p.file_name) from "
    "'(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[ ._-]*[0-9]{2,4}'), '')"
)
EXAM_KEY_SQL = (
    "(p.standard_subject, COALESCE(p.year, ''), "
    + EXAM_SESSION_SQL
    + ", COALESCE(p.exam_type, ''), COALESCE(p.semester, ''), COALESCE(p.branch, ''))"
)

# Question text that REFERS to a provided figure (not "draw a neat sketch",
# which asks the student to produce one).
FIGURE_RE = (
    r"(as shown|shown in (the )?fig|shown below|shown above"
    r"|given (in )?fig(ure)?|the (figure|diagram|graph|circuit) (below|above|given)"
    r"|following (figure|fig|graph|diagram|circuit|network|truss|beam)"
    r"|refer(ring)? to (the )?(fig(ure)?|diagram|graph)"
    r"|from the (fig(ure)?|graph|diagram)"
    r"|for the (circuit|beam|truss|network|figure) shown)"
)

NORM_TEXT_SQL = "lower(regexp_replace(question_text, '\\s+', ' ', 'g'))"

# Label-contamination heuristics: a question whose text contains the
# contradicting modifier but NOT the label's own modifier is probably filed
# under the wrong topic ("singly linked list" question labeled "Doubly
# Linked List Operations"). Deliberately narrow, unambiguous pairs only.
CONTRADICTIONS = [
    ("doubly", "singly"),
    ("singly", "doubly"),
    ("directed", "undirected"),
    ("undirected", "directed"),
    ("max heap", "min heap"),
    ("min heap", "max heap"),
]


def backfill_has_figure(conn):
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE questions SET has_figure = (question_text ~* %s) WHERE has_figure IS NULL",
                (FIGURE_RE,),
            )
            log.info("has_figure backfilled for %d questions", cur.rowcount)


def compute_stats(conn):
    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM subject_stats")
            cur.execute(
                f"""
                INSERT INTO subject_stats (
                    standard_subject, papers, exams, questions, clusters,
                    pct_labeled, distinct_years, years, pct_ocr, pct_figure,
                    max_cluster_size, max_cluster_texts, text_twin_risk
                )
                WITH paper_base AS (
                    SELECT p.standard_subject AS subject,
                           COUNT(DISTINCT p.id)::int AS papers,
                           COUNT(DISTINCT {EXAM_KEY_SQL})::int AS exams
                      FROM papers p JOIN questions q ON q.paper_id = p.id
                     WHERE COALESCE(p.standard_subject, '') <> ''
                     GROUP BY 1
                ),
                q_base AS (
                    SELECT p.standard_subject AS subject,
                           COUNT(q.id)::int AS questions,
                           AVG(CASE WHEN COALESCE(q.has_figure, false) THEN 1.0 ELSE 0 END) AS pct_figure,
                           CASE WHEN COUNT(*) FILTER (WHERE p.extract_method IS NOT NULL) = 0 THEN NULL
                                ELSE AVG(CASE WHEN p.extract_method = 'ocr' THEN 1.0 ELSE 0 END)
                                     FILTER (WHERE p.extract_method IS NOT NULL) END AS pct_ocr
                      FROM questions q JOIN papers p ON p.id = q.paper_id
                     WHERE COALESCE(p.standard_subject, '') <> ''
                     GROUP BY 1
                ),
                year_base AS (
                    SELECT subject, COUNT(*)::int AS distinct_years,
                           jsonb_object_agg(year, papers) AS years
                      FROM (
                        SELECT p.standard_subject AS subject, p.year, COUNT(DISTINCT p.id)::int AS papers
                          FROM papers p JOIN questions q ON q.paper_id = p.id
                         WHERE COALESCE(p.year, '') ~ '^20[0-9]{{2}}$'
                         GROUP BY 1, 2
                      ) y GROUP BY subject
                ),
                cluster_shape AS (
                    SELECT c.standard_subject AS subject,
                           c.id,
                           c.topic IS NOT NULL AS labeled,
                           COUNT(q.id)::int AS members,
                           COUNT(DISTINCT {NORM_TEXT_SQL})::int AS distinct_texts,
                           COUNT(DISTINCT {EXAM_KEY_SQL})::int AS exams,
                           AVG(CASE WHEN COALESCE(q.has_figure, false) THEN 1.0 ELSE 0 END) AS fig_share
                      FROM clusters c
                      JOIN questions q ON q.cluster_id = c.id
                      JOIN papers p ON p.id = q.paper_id
                     GROUP BY c.standard_subject, c.id, c.topic
                ),
                cluster_agg AS (
                    SELECT subject,
                           COUNT(*)::int AS clusters,
                           AVG(CASE WHEN labeled THEN 1.0 ELSE 0 END) AS pct_labeled,
                           MAX(members)::int AS max_cluster_size,
                           (array_agg(distinct_texts ORDER BY members DESC))[1] AS max_cluster_texts,
                           AVG(CASE WHEN distinct_texts <= 2 AND exams >= 3 AND fig_share >= 0.5
                                    THEN 1.0 ELSE 0 END) AS text_twin_risk
                      FROM cluster_shape GROUP BY subject
                )
                SELECT pb.subject, pb.papers, pb.exams, qb.questions,
                       COALESCE(ca.clusters, 0),
                       COALESCE(ca.pct_labeled, 0), COALESCE(yb.distinct_years, 0),
                       COALESCE(yb.years, '{{}}'::jsonb), qb.pct_ocr, qb.pct_figure,
                       COALESCE(ca.max_cluster_size, 0), COALESCE(ca.max_cluster_texts, 0),
                       COALESCE(ca.text_twin_risk, 0)
                  FROM paper_base pb
                  JOIN q_base qb ON qb.subject = pb.subject
                  LEFT JOIN year_base yb ON yb.subject = pb.subject
                  LEFT JOIN cluster_agg ca ON ca.subject = pb.subject
                """
            )
            cur.execute("SELECT COUNT(*) FROM subject_stats")
            log.info("subject_stats rebuilt: %d subjects", cur.fetchone()[0])


def compute_contamination(conn):
    """Count label-contradicting questions per subject into subject_stats."""
    conds = []
    params = []
    for label_kw, text_kw in CONTRADICTIONS:
        conds.append(
            "(c.topic ILIKE %s AND q.question_text ~* %s AND q.question_text !~* %s)"
        )
        params.extend([f"%{label_kw}%", rf"\m{text_kw}\M", rf"\m{label_kw}\M"])
    with conn:
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE subject_stats ADD COLUMN IF NOT EXISTS label_contamination INTEGER")
            cur.execute("UPDATE subject_stats SET label_contamination = 0")
            cur.execute(
                f"""
                UPDATE subject_stats ss SET label_contamination = x.n FROM (
                    SELECT c.standard_subject AS subject, COUNT(*)::int AS n
                      FROM questions q JOIN clusters c ON c.id = q.cluster_id
                     WHERE {" OR ".join(conds)}
                     GROUP BY 1
                ) x WHERE ss.standard_subject = x.subject
                """,
                params,
            )
            log.info("label contamination computed")


def report(conn, top):
    def rows(sql, params=()):
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    sections = [
        (
            "SMALLEST CORPORA (exams asc)",
            "SELECT standard_subject, exams, questions FROM subject_stats ORDER BY exams ASC, questions ASC LIMIT %s",
        ),
        (
            "FIGURE-HEAVY (pct_figure desc)",
            "SELECT standard_subject, ROUND(pct_figure::numeric*100,1), questions FROM subject_stats ORDER BY pct_figure DESC LIMIT %s",
        ),
        (
            "TEXT-TWIN RISK (share of clusters desc)",
            "SELECT standard_subject, ROUND(text_twin_risk::numeric*100,2), clusters FROM subject_stats WHERE clusters > 20 ORDER BY text_twin_risk DESC LIMIT %s",
        ),
        (
            "LEAST LABELED (pct_labeled asc, clusters>0)",
            "SELECT standard_subject, ROUND(pct_labeled::numeric*100,1), clusters FROM subject_stats WHERE clusters > 0 ORDER BY pct_labeled ASC, clusters DESC LIMIT %s",
        ),
        (
            "FEWEST DISTINCT YEARS",
            "SELECT standard_subject, distinct_years, exams FROM subject_stats ORDER BY distinct_years ASC, exams DESC LIMIT %s",
        ),
        (
            "BIGGEST SINGLE CLUSTERS (over-merge suspects)",
            "SELECT standard_subject, max_cluster_size, max_cluster_texts FROM subject_stats ORDER BY max_cluster_size DESC LIMIT %s",
        ),
        (
            "LABEL CONTAMINATION (contradicting-keyword questions)",
            "SELECT standard_subject, label_contamination, questions FROM subject_stats WHERE label_contamination > 0 ORDER BY label_contamination DESC LIMIT %s",
        ),
    ]
    for title, sql in sections:
        print(f"\n=== {title} ===")
        for r in rows(sql, (top,)):
            print("  " + " | ".join(str(x) for x in r))

    ocr = rows("SELECT COUNT(*) FROM subject_stats WHERE pct_ocr IS NOT NULL")[0][0]
    print(
        f"\nOCR share: tracked for {ocr} subjects (extract_method persisted only for "
        "papers ingested after tracking landed — see findings)."
    )


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args()

    conn = db.get_conn()
    try:
        backfill_has_figure(conn)
        compute_stats(conn)
        compute_contamination(conn)
        report(conn, args.top)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
