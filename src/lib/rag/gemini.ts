/**
 * Runtime Gemini client for /api/ask.
 *
 * Every call round-robins across ALL keys in GEMINI_API_KEYS via the
 * KeyRotator (random start per instance, advance per request, cooldown on
 * per-minute 429s, benched-for-the-UTC-day on daily-quota 429s). Callers
 * degrade only when every key is benched.
 *
 * Gemini 3.x are thinking models; chat answers need speed, not reasoning,
 * so requests ask for minimal thinking and silently drop the config if the
 * configured model rejects it (mirrors the pipeline's fallback ladder).
 */

import {
  AllKeysBenched,
  acquireKey,
  benchKey,
  benchKeyForDay,
  keyAvailability,
} from "./key-rotator";
import { recordCall } from "./providers/registry";
import { ProviderModelDead, ProviderTransient, ProvidersUnavailable } from "./providers/types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

/**
 * Gemini is rate-limited or down — callers degrade. Now an alias of the
 * lane-wide ProvidersUnavailable so existing `instanceof` checks keep
 * working after the multi-provider split (a lane that exhausts EVERY
 * provider is exactly the condition this used to mean).
 */
export { ProvidersUnavailable as GeminiUnavailable } from "./providers/types";

// Sticky per-instance: once the model rejects thinkingConfig we stop sending it.
let sendThinkingConfig = true;

interface GenerateOptions {
  json?: boolean;
  timeoutMs?: number;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * finishReasons that mean a safety/policy filter cut the answer. Whatever text
 * came back is a fragment at best, never an answer to serve.
 */
const BLOCKED_FINISH = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

/** Pipeline-style 429 anatomy: daily-quota vs per-minute, with retryDelay. */
function parse429(body: string): { daily: boolean; retryMs: number } {
  const daily = /perday/i.test(body);
  const m =
    /retry_?[dD]elay\\?"?\s*:\s*\\?"?(\d+)/.exec(body) ?? /"retryDelay"\s*:\s*"(\d+)/.exec(body);
  const retryMs = m ? (Number(m[1]) + 1) * 1000 : 30_000;
  return { daily, retryMs };
}

// Key indexes only — never values (same contract as the pipeline).
// Also feeds the per-provider daily counters behind /api/health.
function logKey(index: number, outcome: string): void {
  console.log(JSON.stringify({ evt: "gemini_call", key_index: index, outcome }));
  recordCall("gemini", outcome);
}

/**
 * Model reachability check for the provider preflight: a metadata GET, so it
 * costs no generation quota. A 404 means the configured GEMINI_MODEL is
 * retired or misspelled — a deploy bug, surfaced as ProviderModelDead.
 *
 * A REJECTED KEY is a problem with that key, not with the provider: it is
 * benched for the day exactly like generateText() benches it, and the check
 * moves on to the next key. Only when every key in the pool has been refused
 * is it a misconfigured GEMINI_API_KEYS — that aborts loudly as
 * ProviderModelDead (so a single-key deployment with a bad key still does).
 */
export async function geminiPreflight(): Promise<void> {
  const rejected = new Map<number, number>(); // key index -> HTTP status
  for (;;) {
    let key: string;
    let index: number;
    try {
      ({ key, index } = acquireKey());
    } catch (err) {
      if (!(err instanceof AllKeysBenched)) {
        throw new ProviderModelDead("gemini", GEMINI_MODEL, "GEMINI_API_KEYS is not set");
      }
      const total = keyAvailability().total;
      if (rejected.size > 0 && rejected.size === total) {
        const statuses = [...new Set(rejected.values())].join("/");
        throw new ProviderModelDead(
          "gemini",
          GEMINI_MODEL,
          `every key in GEMINI_API_KEYS was rejected (${total} of ${total}, HTTP ${statuses}) — check the keys`,
        );
      }
      throw new ProvidersUnavailable("all Gemini keys are rate-limited or out of quota");
    }

    const resp = await fetch(`${API_BASE}/${GEMINI_MODEL}?key=${key}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.status === 404) {
      throw new ProviderModelDead("gemini", GEMINI_MODEL, "model not found (HTTP 404)");
    }
    if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
      // Loud, and by index only — a revoked or typo'd key needs replacing.
      console.error(
        JSON.stringify({
          evt: "gemini_key_rejected",
          phase: "preflight",
          key_index: index,
          status: resp.status,
        }),
      );
      benchKeyForDay(index);
      rejected.set(index, resp.status);
      continue;
    }
    // Anything else (5xx, network) is transient; the caller retries the check.
    if (!resp.ok) throw new Error(`Gemini preflight HTTP ${resp.status}`);
    return;
  }
}

export async function generateText(
  prompt: string,
  { json = false, timeoutMs = 30_000 }: GenerateOptions = {},
): Promise<string> {
  let retriedServerError = false;
  // Enough attempts to visit every key twice even in a large pool.
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let index: number;
    let key: string;
    try {
      ({ key, index } = acquireKey());
    } catch (err) {
      if (err instanceof AllKeysBenched) {
        throw new ProvidersUnavailable("all Gemini keys are rate-limited or out of quota");
      }
      throw err;
    }

    const generationConfig: Record<string, unknown> = { temperature: 0 };
    if (json) generationConfig.responseMimeType = "application/json";
    if (sendThinkingConfig) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };

    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Timeouts and network failures degrade like quota exhaustion —
      // callers fall back to retrieval/analytics instead of a 500. Not a
      // key problem, so no bench.
      logKey(index, "network_error");
      throw new ProvidersUnavailable(
        `Gemini unreachable (${err instanceof Error ? err.name : "network error"}) — try again shortly`,
      );
    }

    if (resp.ok) {
      // Everything below throws ProviderTransient, never a raw Error: the
      // router benches Gemini briefly and hands the request to the next
      // provider, where a raw Error escapes the router and /api/ask 500s
      // (the same contract the OpenAI-compatible adapter keeps).
      //
      // Reading the body can abort on the timeout signal too — a slow stream
      // still arriving past the deadline throws here, not at fetch().
      let body: GenerateContentResponse;
      try {
        body = (await resp.json()) as GenerateContentResponse;
      } catch (err) {
        logKey(index, "body_read_error");
        throw new ProviderTransient(
          `Gemini response unreadable (${err instanceof Error ? err.name : "stream error"})`,
          "gemini",
        );
      }
      const candidate = body.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      const finish = candidate?.finishReason;
      const blockReason =
        body.promptFeedback?.blockReason ?? (finish && BLOCKED_FINISH.has(finish) ? finish : null);
      if (blockReason) {
        logKey(index, `blocked_${blockReason.toLowerCase()}`);
        throw new ProviderTransient(`Gemini blocked the response (${blockReason})`, "gemini");
      }
      if (!text.trim()) {
        logKey(index, "empty");
        throw new ProviderTransient("Gemini returned an empty candidate", "gemini");
      }
      // Stopped mid-sentence: half an answer is worse than letting a provider
      // that can finish it take the request.
      if (finish === "MAX_TOKENS") {
        logKey(index, "truncated");
        throw new ProviderTransient("Gemini truncated its answer at the token cap", "gemini");
      }
      logKey(index, "ok");
      return text;
    }

    // Same hazard on the error path: never let a body read escape raw.
    let errText: string;
    try {
      errText = await resp.text();
    } catch {
      errText = "";
    }

    if (resp.status === 400 && sendThinkingConfig && errText.toLowerCase().includes("thinking")) {
      sendThinkingConfig = false; // model doesn't take thinkingConfig; drop it for this instance
      continue;
    }
    if (resp.status === 429) {
      const { daily, retryMs } = parse429(errText);
      if (daily) {
        logKey(index, "quota_benched_for_day");
        benchKeyForDay(index);
      } else {
        logKey(index, `rate_limited_${Math.round(retryMs / 1000)}s`);
        benchKey(index, retryMs);
      }
      continue; // next key
    }
    if (resp.status === 401 || resp.status === 403) {
      logKey(index, `rejected_${resp.status}`);
      benchKeyForDay(index); // bad key — out for the day
      continue;
    }
    if (resp.status >= 500) {
      // Google-side overload or outage ("This model is currently experiencing
      // high demand"), not a key problem — so no key is benched. The first one
      // is worth another key, since a spike can be local to one backend. A
      // second means Gemini itself is struggling: hand the request down the
      // ladder like any other transient provider failure, instead of throwing
      // a raw Error that the router can only rethrow and /api/ask can only
      // turn into a 500.
      if (!retriedServerError) {
        retriedServerError = true;
        logKey(index, `server_${resp.status}`);
        continue;
      }
      logKey(index, `error_${resp.status}`);
      throw new ProviderTransient(
        `Gemini HTTP ${resp.status}: ${errText.slice(0, 200)}`,
        "gemini",
      );
    }
    logKey(index, `error_${resp.status}`);
    throw new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 300)}`);
  }

  throw new ProvidersUnavailable("Gemini request did not succeed after rotating keys");
}
