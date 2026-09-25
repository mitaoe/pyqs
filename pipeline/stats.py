"""Print pipeline progress stats (papers by status, questions, clusters).

Used as the final step of the Actions workflow so every run's summary is
visible in the job log; the /api/stats endpoint exposes the same numbers.
"""

import db


def main():
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT status, count(*) FROM papers GROUP BY status ORDER BY status")
            print("papers by status:")
            for status, count in cur.fetchall():
                print(f"  {status:>8}: {count}")

            cur.execute("""
                SELECT count(*),
                       count(embedding),
                       count(cluster_id)
                FROM questions
            """)
            total, embedded, clustered = cur.fetchone()
            print(f"questions: {total} total, {embedded} embedded, {clustered} clustered")

            cur.execute("SELECT count(*), count(DISTINCT standard_subject) FROM clusters")
            n_clusters, n_subjects = cur.fetchone()
            print(f"clusters: {n_clusters} across {n_subjects} subjects")

            cur.execute("""
                SELECT p.standard_subject, count(q.id) AS n
                FROM questions q JOIN papers p ON p.id = q.paper_id
                GROUP BY p.standard_subject ORDER BY n DESC LIMIT 15
            """)
            rows = cur.fetchall()
            if rows:
                print("top subjects by question count:")
                for subject, n in rows:
                    print(f"  {n:>6}  {subject}")

            cur.execute("""
                SELECT id, file_name, left(error, 120)
                FROM papers WHERE status = 'failed'
                ORDER BY id DESC LIMIT 10
            """)
            rows = cur.fetchall()
            if rows:
                print("recent failures:")
                for paper_id, file_name, error in rows:
                    print(f"  #{paper_id} {file_name}: {error}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
