/**
 * Runtime tunables for the API (the Python pipeline has its own
 * pipeline/config.py — keep the two in sync where concepts overlap).
 */

/**
 * TOPIC_ANALYTICS: minimum cosine similarity between the embedded topic
 * phrase (e.g. "hashing") and a cluster's centroid for that cluster to count
 * as being "about" the topic. Short phrases score lower against full
 * question sentences than question-vs-question pairs do, so this sits well
 * below the pipeline's 0.80 clustering threshold. Calibrated on live data:
 * "hashing" scores 0.39–0.61 against Data Structures' hash clusters, 0.33
 * against the nearest off-topic cluster; cross-subject noise stays < 0.15.
 */
export const TOPIC_MATCH_THRESHOLD = Number(process.env.TOPIC_MATCH_THRESHOLD ?? 0.4);

/**
 * SEMANTIC: retrieval hits below this cosine similarity don't count as
 * coverage; fewer than MIN_GROUNDING_HITS hits at/above it means the papers
 * don't cover the query — the API answers honestly instead of synthesizing.
 * Calibrated on live data with the production full-scan search: on-topic
 * queries score 0.68–0.88 top-1 (weakest: "what is subnetting..." 0.680);
 * obscure/adjacent queries top out at 0.418 ("blockchain consensus" asked
 * in Computer Networks); cross-domain noise sits below 0.27.
 */
export const SEMANTIC_MIN_SIMILARITY = Number(process.env.SEMANTIC_MIN_SIMILARITY ?? 0.45);
export const MIN_GROUNDING_HITS = 2;

/**
 * Prose word caps for Gemini-written answers. Strategy answers stay tight;
 * explanations may stretch when teaching requires it. Enforced server-side
 * with one corrective retry.
 */
export const PROSE_WORDS_STRATEGY = 150;
export const PROSE_WORDS_EXPLAIN = 200;

/**
 * Priority tiers for topic/analytics rows, as a fraction of the subject's
 * total exams: >= MUST -> "Must know", >= SHOULD -> "Should know",
 * below -> "If time permits".
 */
export const PRIORITY_MUST_RATIO = 0.35;
export const PRIORITY_SHOULD_RATIO = 0.15;


/** Below these, tiers/percentages are suppressed and answers carry a
 *  small-archive caveat — 2-of-3-exams is indicative, not a trend. */
export const SMALL_CORPUS_EXAMS = 8;
export const SMALL_CORPUS_QUESTIONS = 100;

/** YEAR_TREND refuses rising/fading labels below this many distinct years. */
export const TREND_MIN_YEARS = 3;

/** Audit pct_figure at/above this adds the figure-methodology note. */
export const FIGURE_HEAVY_SHARE = 0.25;

/** Skip/deprioritize candidates must appear in at most this many exams. */
export const SKIP_TAIL_MAX_EXAMS = 3;

/** Upper bound on clusters fetched for a topic query — the exhaustive
 *  ("all questions") ceiling and the denominator for "top 10 of N". */
export const MAX_TOPIC_CLUSTERS = 150;
