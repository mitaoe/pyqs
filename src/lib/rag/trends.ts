import { EXAM_KEY_SQL } from "./analytics";
import { TREND_MIN_YEARS } from "./config";
import { getPool } from "./db";

export type TrendStatus = "rising" | "staple" | "fading" | null;

export interface TrendTopic {
  topic: string;
  /** Total distinct exams (years partition exams, so the row sum). */
  exam_count: number;
  /** Distinct-exam count per year, aligned to YearTrend.years. */
  counts: number[];
  first_year: string;
  last_year: string;
  status: TrendStatus;
}

export interface YearTrend {
  /** True when too few distinct years exist to call rising/fading. */
  insufficient_years: boolean;
  years: string[];
  topics: TrendTopic[];
  rising: string[];
  staples: string[];
  faded: string[];
}

const MAX_TREND_TOPICS = 12;

/**
 * Per-year distinct-exam counts by canonical topic. Null when the subject
 * has no labeled topics yet. Status per topic, relative to the newest year
 * with data: rising = first appeared within the last 2 years and is still
 * current; fading = absent for 2+ years; staple = long-standing and current.
 */
export async function yearTrend(subject: string): Promise<YearTrend | null> {
  const res = await getPool().query(
    `SELECT c.topic, p.year, COUNT(DISTINCT ${EXAM_KEY_SQL})::int AS exam_count
       FROM clusters c
       JOIN questions q ON q.cluster_id = c.id
       JOIN papers p ON p.id = q.paper_id
      WHERE c.standard_subject = $1
        AND c.topic IS NOT NULL
        AND COALESCE(p.year, '') ~ '^20[0-9]{2}$'
      GROUP BY c.topic, p.year`,
    [subject],
  );
  const rows = res.rows as { topic: string; year: string; exam_count: number }[];
  if (rows.length === 0) return null;

  const years = [...new Set(rows.map((r) => r.year))].sort();
  const latest = Number(years[years.length - 1]);
  const insufficientYears = years.length < TREND_MIN_YEARS;
  const byTopic = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byTopic.get(r.topic) ?? new Map<string, number>();
    m.set(r.year, r.exam_count);
    byTopic.set(r.topic, m);
  }

  const all: TrendTopic[] = [...byTopic.entries()].map(([topic, perYear]) => {
    const counts = years.map((y) => perYear.get(y) ?? 0);
    const present = years.filter((y) => (perYear.get(y) ?? 0) > 0);
    const first = Number(present[0]);
    const last = Number(present[present.length - 1]);
    const total = counts.reduce((s, n) => s + n, 0);
    let status: TrendStatus = null;
    // With <TREND_MIN_YEARS distinct years, rising/fading labels would be
    // noise — every status stays null and the summary says why.
    if (!insufficientYears) {
      if (last <= latest - 2 && total >= 2) status = "fading";
      else if (first >= latest - 2 && total >= 2) status = "rising";
      else if (first <= latest - 3 && last >= latest - 1) status = "staple";
    }
    return {
      topic,
      exam_count: total,
      counts,
      first_year: present[0],
      last_year: present[present.length - 1],
      status,
    };
  });

  all.sort((a, b) => b.exam_count - a.exam_count || a.topic.localeCompare(b.topic));
  const pickNames = (s: TrendStatus) =>
    all
      .filter((t) => t.status === s)
      .slice(0, 3)
      .map((t) => t.topic);
  const rising = pickNames("rising");
  const staples = pickNames("staple");
  const faded = pickNames("fading");

  // Top-N by weight, but the named rising/faded topics always make the cut.
  const named = new Set([...rising, ...faded]);
  const topics = [
    ...all.slice(0, MAX_TREND_TOPICS),
    ...all.slice(MAX_TREND_TOPICS).filter((t) => named.has(t.topic)),
  ];

  return { insufficient_years: insufficientYears, years, topics, rising, staples, faded };
}
