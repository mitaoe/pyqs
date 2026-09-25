/**
 * Query normalization ahead of classification/embedding: students type fast
 * and abbreviated on phones. Expansions are word-boundary and conservative —
 * only unambiguous study shorthand.
 */

const EXPANSIONS: [RegExp, string][] = [
  [/\bimp\b/gi, "important"],
  [/\b(?:ques|qs|que|qstn|qsn)\b/gi, "questions"],
  [/\bfreq\b/gi, "frequently"],
  [/\byr\b/gi, "year"],
  [/\bsem\b/gi, "semester"],
  [/\bdefn?\b/gi, "definition"],
  [/\bexpl?[ai]?n\b/gi, "explain"],
  [/\bw\/o\b/gi, "without"],
  [/\bb\/w\b/gi, "between"],
  [/\bdiff\b/gi, "difference"],
];

// High-value intent tokens: a typo here must never derail routing into the
// no-answer path. Repaired by edit distance (1 for short words, 2 for long).
const FUZZY_TOKENS = [
  "important",
  "questions",
  "topics",
  "study",
  "repeated",
  "weightage",
  "explain",
  "asked",
];

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function repairToken(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 5 || FUZZY_TOKENS.includes(w)) return word;
  const max = w.length >= 8 ? 2 : 1;
  for (const t of FUZZY_TOKENS) {
    if (editDistance(w, t, max) <= max) return t;
  }
  return word;
}

export function normalizeQuery(question: string): string {
  let q = question.trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of EXPANSIONS) {
    q = q.replace(pattern, replacement);
  }
  return q.replace(/[a-zA-Z]{5,}/g, repairToken);
}
