/**
 * Shared vocabulary for the multi-provider runtime.
 *
 * Two CALL-TYPE LANES, each with its own provider ladder (see ./index.ts):
 *   - "classification": tiny, high-volume, cheap. Falls back to regex-only.
 *   - "synthesis": the expensive prose call. Falls back to degraded mode.
 *
 * The error taxonomy is the important part, because it decides whether a
 * failure DEGRADES (serve something honest) or ABORTS (shout at the
 * operator):
 *
 *   ProviderRateLimited  -> this provider is out of quota for now.
 *                           Bench it, try the next one. Normal operation.
 *   ProviderTransient    -> network blip / 5xx. Short bench, try the next.
 *   ProvidersUnavailable -> every provider in the lane is exhausted.
 *                           Callers degrade honestly (this is the old
 *                           GeminiUnavailable, kept as an alias).
 *   ProviderModelDead    -> the configured model 404s, or the key is
 *                           rejected. That is a DEPLOY BUG, not a quota
 *                           event: it must never masquerade as exhausted
 *                           quota, so it propagates and aborts the lane.
 */

export type Lane = "classification" | "synthesis";

export type ProviderName = "gemini" | "groq" | "openrouter";

export const PROVIDER_NAMES: ProviderName[] = ["gemini", "groq", "openrouter"];

export function isProviderName(v: string): v is ProviderName {
  return (PROVIDER_NAMES as string[]).includes(v);
}

/** Every provider in the lane is rate-limited or out of quota. Degrade. */
export class ProvidersUnavailable extends Error {}

/** This provider is out of quota; the router benches it and moves on. */
export class ProviderRateLimited extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    /** true = daily quota (bench until next UTC day), false = per-minute. */
    readonly daily: boolean,
    readonly retryMs: number,
  ) {
    super(message);
  }
}

/** Network error / 5xx: not the provider's fault, short bench and move on. */
export class ProviderTransient extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
  ) {
    super(message);
  }
}

/**
 * The configured model does not exist, or the key is rejected. Misconfiguration
 * — NOT a quota event. Aborts the lane loudly instead of silently degrading,
 * so a typo'd model id can't hide behind "AI answers are resting".
 */
export class ProviderModelDead extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly model: string,
    readonly detail: string,
  ) {
    super(`${provider} model "${model}" is unusable: ${detail}`);
  }
}

export interface GenerateOptions {
  /** Ask for a JSON object back (classification). */
  json?: boolean;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  /** Model id this provider uses for the given lane. */
  modelFor(lane: Lane): string;
  /** False when the provider's key env var is unset — the router skips it. */
  configured(): boolean;
  /**
   * Verify the lane's model is reachable. Memoized per provider+model for the
   * life of the instance. Throws ProviderModelDead when it isn't.
   */
  preflight(lane: Lane): Promise<void>;
  generate(lane: Lane, prompt: string, opts: GenerateOptions): Promise<string>;
}
