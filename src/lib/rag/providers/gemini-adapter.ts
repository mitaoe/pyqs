/**
 * Gemini as a lane provider. Thin on purpose: the real work (round-robin over
 * every key in GEMINI_API_KEYS, per-minute cooldowns, benched-for-the-day on
 * daily quota) already lives in ../gemini.ts and ../key-rotator.ts and is
 * unchanged by the multi-provider split.
 *
 * The only translation that matters: "every Gemini key is benched" is not the
 * end of the world any more — it is a signal for the router to try the next
 * provider. So it becomes ProviderRateLimited with a SHORT bench: the key
 * rotator is the real gate, and Gemini must come back the moment a key frees
 * up rather than sitting out the rest of the day.
 */

import { GEMINI_MODEL, generateText, geminiPreflight } from "../gemini";
import { preflightStatus, setPreflight } from "./registry";
import {
  ProviderModelDead,
  ProviderRateLimited,
  ProviderTransient,
  ProvidersUnavailable,
  type GenerateOptions,
  type Lane,
  type ProviderAdapter,
} from "./types";

/** Re-ask the key rotator a minute later; it holds the per-key state. */
const KEY_POOL_RECHECK_MS = 60_000;

export const geminiAdapter: ProviderAdapter = {
  name: "gemini",

  modelFor: () => GEMINI_MODEL,

  configured: () => (process.env.GEMINI_API_KEYS ?? "").split(",").some((k) => k.trim().length > 0),

  async preflight(lane: Lane): Promise<void> {
    const model = GEMINI_MODEL;
    const cached = preflightStatus("gemini", lane, model);
    if (cached.status === "ok") return;
    if (cached.status === "dead") {
      throw new ProviderModelDead("gemini", model, cached.detail ?? "preflight failed");
    }
    try {
      await geminiPreflight();
    } catch (err) {
      if (err instanceof ProviderModelDead) {
        setPreflight("gemini", lane, model, "dead", err.detail);
        console.error(
          JSON.stringify({
            evt: "provider_preflight_failed",
            provider: "gemini",
            lane,
            model,
            detail: err.detail,
          }),
        );
        throw err;
      }
      if (err instanceof ProvidersUnavailable) {
        // Keys all cooling down — not a dead model. Verdict stays "unknown".
        throw new ProviderRateLimited(err.message, "gemini", false, KEY_POOL_RECHECK_MS);
      }
      throw new ProviderTransient(
        `gemini preflight failed (${err instanceof Error ? err.message : "unknown"})`,
        "gemini",
      );
    }
    setPreflight("gemini", lane, model, "ok");
  },

  async generate(lane: Lane, prompt: string, opts: GenerateOptions): Promise<string> {
    try {
      return await generateText(prompt, { json: opts.json, timeoutMs: opts.timeoutMs });
    } catch (err) {
      if (err instanceof ProvidersUnavailable) {
        // Covers both "every key benched" and network/timeout failures —
        // either way the router should move on and retry Gemini shortly.
        throw new ProviderRateLimited(err.message, "gemini", false, KEY_POOL_RECHECK_MS);
      }
      throw err;
    }
  },
};
