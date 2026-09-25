/**
 * Runtime key rotation across ALL keys in GEMINI_API_KEYS — the serverless
 * adaptation of the pipeline's KeyManager. Vercel instances share no state,
 * so each instance starts at a RANDOM index and advances per request: across
 * instances that yields an even spread without coordination.
 *
 * Cooldown semantics mirror the pipeline: per-minute 429s bench a key
 * briefly (honoring retryDelay), daily-quota 429s bench it until the next
 * UTC day. Only when every key is benched do callers degrade.
 *
 * Key count is fully dynamic (1..N); a single-key deployment simply
 * round-robins over one key. Key VALUES are never logged — indexes only.
 */

interface KeyStore {
  keys: string[];
  benchedUntil: number[]; // epoch ms per key; 0 = available
  cursor: number;
  sig: string;
}

const globalForKeys = globalThis as unknown as { pyqKeyRotator?: KeyStore };

function parseKeys(): string[] {
  return (process.env.GEMINI_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function store(): KeyStore {
  const keys = parseKeys();
  const sig = `${keys.length}:${keys.map((k) => k.length).join(",")}`;
  let s = globalForKeys.pyqKeyRotator;
  if (!s || s.sig !== sig) {
    s = {
      keys,
      benchedUntil: keys.map(() => 0),
      cursor: keys.length > 0 ? Math.floor(Math.random() * keys.length) : 0,
      sig,
    };
    globalForKeys.pyqKeyRotator = s;
  }
  return s;
}

export class AllKeysBenched extends Error {}

/** Next available key, round-robin, skipping benched ones. */
export function acquireKey(): { key: string; index: number } {
  const s = store();
  if (s.keys.length === 0) throw new Error("GEMINI_API_KEYS is not set");
  const now = Date.now();
  for (let i = 0; i < s.keys.length; i++) {
    const idx = (s.cursor + i) % s.keys.length;
    if (s.benchedUntil[idx] <= now) {
      s.cursor = (idx + 1) % s.keys.length;
      return { key: s.keys[idx], index: idx };
    }
  }
  throw new AllKeysBenched("all Gemini keys are cooling down or quota-benched");
}

/** Short cooldown (per-minute 429, transient auth hiccups). */
export function benchKey(index: number, ms: number): void {
  const s = store();
  if (index < 0 || index >= s.keys.length) return;
  s.benchedUntil[index] = Math.max(s.benchedUntil[index], Date.now() + ms);
}

/** Daily-quota 429: out until the next UTC day (per the reset contract). */
export function benchKeyForDay(index: number): void {
  const next = new Date();
  next.setUTCHours(24, 0, 30, 0); // next UTC midnight + 30s grace
  benchKey(index, next.getTime() - Date.now());
}

/** For /api/health: how many keys are usable right now. */
export function keyAvailability(): { total: number; available: number; benched: number } {
  const s = store();
  const now = Date.now();
  const available = s.benchedUntil.filter((t) => t <= now).length;
  return { total: s.keys.length, available, benched: s.keys.length - available };
}

/** Test-only: drop cached state so env changes take effect immediately. */
export function _resetKeyRotatorForTests(): void {
  globalForKeys.pyqKeyRotator = undefined;
}
