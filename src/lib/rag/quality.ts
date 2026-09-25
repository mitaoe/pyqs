/**
 * Server-side answer-quality contract for Gemini prose: length caps, banned
 * filler/consultant-speak, verdict-first shape. A failing draft gets ONE
 * corrective retry; the better draft is served (availability beats polish)
 * with the failure logged.
 */

export const BANNED_PHRASES: RegExp[] = [
  /to maximi[sz]e your (?:efficiency|score|marks|results)/i,
  /it is important to (?:note|remember|understand)/i,
  /it'?s (?:important|worth) (?:to note|noting)/i,
  /high[- ]value (?:area|topic|question)/i,
  /long[- ]standing staples?/i,
  /\bin conclusion\b/i,
  /\bdelve\b/i,
  /\bleverage\b/i,
  /\butili[sz]e\b/i,
  /comprehensive understanding/i,
  /crucial (?:role|aspect)/i,
  /in the realm of/i,
  /\bfurthermore\b/i,
  /be strategic about/i,
];

export function countWords(text: string): number {
  const stripped = text
    .replace(/[*_#>`]/g, " ")
    .replace(/\[(\d+)\]/g, " ") // citation chips aren't prose
    .trim();
  return stripped.length === 0 ? 0 : stripped.split(/\s+/).length;
}

export interface QualityVerdict {
  ok: boolean;
  problems: string[];
}

/**
 * Skip-contract guard, independent of the prompt: a skip-type answer must
 * contain the literal words "not skippable" and must never name a protected
 * (>3-exam) topic inside a positive skip/deprioritize sentence. Returns a
 * human-readable violation, or null when clean.
 */
export function skipContractViolation(answer: string, protectedTopics: string[]): string | null {
  if (!/not skippable/i.test(answer)) {
    return 'missing the mandatory "not skippable" statement';
  }
  // Sentence boundaries may be wrapped in closing markdown ("skippable.**")
  const sentences = answer.split(/(?<=[.!?])[*_)"']*\s+|\n+/);
  for (const s of sentences) {
    const skipTalk =
      /\bskip|deprioriti[sz]|leave\s+(?:out|for\s+(?:the\s+)?last)|less\s+(?:priority|focus|time)|\bdrop(?:ped|ping)?\b|postpone|ignore/i.test(
        s,
      );
    if (!skipTalk) continue;
    // negated / protective sentences are fine ("X is not skippable")
    if (/\bnot\b|n't\b|cannot|never|keep|essential|avoid/i.test(s)) continue;
    for (const t of protectedTopics) {
      if (t && s.toLowerCase().includes(t.toLowerCase())) {
        return `names protected topic "${t}" as a skip candidate`;
      }
    }
  }
  return null;
}

export function checkAnswerQuality(
  answer: string,
  opts: { maxWords: number; requireVerdictFirst?: boolean },
): QualityVerdict {
  const problems: string[] = [];

  const words = countWords(answer);
  if (words > opts.maxWords) problems.push(`too long: ${words} words (cap ${opts.maxWords})`);

  for (const re of BANNED_PHRASES) {
    const m = re.exec(answer);
    if (m) problems.push(`banned phrase: "${m[0]}"`);
  }

  if (opts.requireVerdictFirst !== false) {
    const firstLine = answer.split("\n").find((l) => l.trim().length > 0) ?? "";
    if (!/^\s*\*\*[^*]/.test(firstLine)) {
      problems.push("missing bold verdict line first");
    }
  }

  return { ok: problems.length === 0, problems };
}
