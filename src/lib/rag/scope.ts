/**
 * Layer 0 of the scope gate: zero-cost regex prefilter for obvious abuse.
 *
 * Deliberately conservative — exam questions legitimately say things like
 * "write a C program for linked lists", so only unambiguous jailbreak /
 * persona / non-academic-task patterns are caught here. Everything subtler
 * is judged by the classifier (which returns in_scope in the same Gemini
 * call as intent, costing nothing extra).
 */

const ABUSE_PATTERNS: RegExp[] = [
  // meta-instruction / prompt attacks ("ignore [all] [your] previous instructions");
  // requires a previous/system-style qualifier so "ignore firewall rules" stays legal
  /(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:your\s+|the\s+|my\s+)?(?:previous|prior|above|earlier|initial|original|system)\s+(?:instructions?|prompts?|rules?)/i,
  /ignore\s+your\s+(?:instructions?|prompts?|rules?)/i,
  /\b(?:system|hidden|secret)\s+prompt\b/i,
  /\b(?:reveal|show|print)\s+(?:me\s+)?your\s+(?:instructions?|prompt|rules)/i,
  // persona switching / jailbreak
  /\byou\s+are\s+(?:now\s+)?(?:an?\s+)?(?:unrestricted|uncensored|jailbroken|free)\b/i,
  /\b(?:DAN|jailbreak|jailbroken|developer\s+mode)\b/i,
  /^(?:please\s+)?(?:act\s+as|pretend\s+(?:to\s+be|you)|roleplay|role-play)\b/i,
  // clearly non-academic tasks
  /write\s+(?:me\s+)?(?:a\s+|an\s+)?(?:poem|song|story|essay|rap|joke|tweet|cover\s+letter|resume|love\s+letter)\b/i,
  /translate\s+.{0,60}\s(?:to|into)\s+(?:hindi|marathi|english|french|german|spanish|\w+ese)\b/i,
  /\b(?:girlfriend|boyfriend|dating|breakup|relationship\s+advice)\b/i,
];

export function prefilterAbuse(question: string): boolean {
  return ABUSE_PATTERNS.some((p) => p.test(question));
}

/** One polite sentence; always suggests what CAN be asked. */
export function refusalMessage(subject: string): string {
  return `I can only help with **${subject}** previous-year papers — try asking about its repeated questions, a specific topic, or how to approach a question from the papers.`;
}

/**
 * Bare "?", "hi" and similar pokes: not abuse, just someone knocking —
 * answer with a friendly capabilities nudge, never the refusal.
 */
const GREETING_RE =
  /^(?:[\s?!.…~-]+|(?:hi+|hii+|hey+|hello+|helo+|yo|sup|hola|namaste|hy|test|ping|ok(?:ay)?|good\s+(?:morning|afternoon|evening))[\s?!.…]*)$/i;

export function isGreeting(question: string): boolean {
  return GREETING_RE.test(question.trim());
}

export function greetingMessage(subject: string): string {
  return `Hey! 👋 I'm your **${subject}** past-paper assistant. Try one of these:\n\n- "most important topics"\n- "what usually gets asked about *<topic>*"\n- "how should I study for the exam"\n- or ask me to explain any concept from the papers`;
}
