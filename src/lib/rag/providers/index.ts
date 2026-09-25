/**
 * The two-lane provider router.
 *
 * Lanes exist because the two kinds of LLM call have opposite economics:
 *
 *   classification — thousands per day, one short JSON object each. Wants the
 *     highest request-per-day ceiling available, quality barely matters.
 *     Ladder default: Groq -> Gemini -> (caller falls back to regex-only).
 *
 *   synthesis — the expensive prose call the student actually reads. Wants
 *     the best writer first, with real fallbacks behind it.
 *     Ladder default: Gemini -> Groq -> OpenRouter -> (caller degrades).
 *
 * Both ladders, and every model id, are env-overridable — nothing here
 * hardcodes a provider count or a model name that an operator can't change.
 *
 * Failure policy (see ./types.ts): quota exhaustion walks down the ladder and
 * ends in an honest degrade; a DEAD MODEL aborts the lane loudly, because a
 * misconfigured model id that silently degrades is a bug that never gets
 * found.
 */

import { logEvent } from "../obs";
import { geminiAdapter } from "./gemini-adapter";
import { createOpenAICompatAdapter } from "./openai-compat";
import { benchProvider, benchProviderForDay, isBenched, preflightStatus, snapshot } from "./registry";
import {
  ProviderModelDead,
  ProviderRateLimited,
  ProviderTransient,
  ProvidersUnavailable,
  isProviderName,
  type GenerateOptions,
  type Lane,
  type ProviderAdapter,
  type ProviderName,
} from "./types";

/**
 * Groq's OpenAI-compatible endpoint. Model ids are env-overridable: the
 * catalogue available to a given key changes over time, and a dead default
 * must be fixable with an env var, not a redeploy.
 */
const groqAdapter = createOpenAICompatAdapter({
  name: "groq",
  baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  apiKeyEnv: "GROQ_API_KEY",
  models: {
    classification: { env: "GROQ_CLASSIFICATION_MODEL", fallback: "openai/gpt-oss-20b" },
    synthesis: { env: "GROQ_SYNTHESIS_MODEL", fallback: "openai/gpt-oss-120b" },
  },
  // gpt-oss models spend their whole token budget reasoning without this.
  reasoningEffort: "low",
});

/**
 * OpenRouter's free tier — the last rung before degraded mode.
 *
 * Model choice matters more here than anywhere else, because most `:free`
 * slugs share ONE upstream pool across every OpenRouter user. Benchmarked on
 * the real synthesis prompt (2 calls each): both gemma-4 `:free` variants
 * returned 429 "temporarily rate-limited upstream" every time, inkling 403'd,
 * dots-3 returned empty completions, and nemotron-3.5-lightning leaked its
 * chain of thought into the answer. nemotron-3-super answered 2/2 in ~350ms,
 * verdict-first and in-cap — so it is the default. Override with
 * OPENROUTER_SYNTHESIS_MODEL.
 */
const openrouterAdapter = createOpenAICompatAdapter({
  name: "openrouter",
  baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKeyEnv: "OPENROUTER_API_KEY",
  models: {
    classification: {
      env: "OPENROUTER_CLASSIFICATION_MODEL",
      fallback: "nvidia/nemotron-3-super-120b-a12b:free",
    },
    synthesis: {
      env: "OPENROUTER_SYNTHESIS_MODEL",
      fallback: "nvidia/nemotron-3-super-120b-a12b:free",
    },
  },
  // Measured failure mode: nemotron answers in well under 2s or hangs
  // outright. Capping at 25s turns a hang into a fast fall-through to
  // degraded mode instead of eating the route's whole 60s budget.
  maxTimeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 25_000),
  headers: {
    // OpenRouter attribution — identifies the app in their dashboard.
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://mitaoe-pyqs.vercel.app",
    "X-Title": "MITAoE PYQ Assistant",
  },
});

const ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  gemini: geminiAdapter,
  groq: groqAdapter,
  openrouter: openrouterAdapter,
};

export function adapterFor(name: ProviderName): ProviderAdapter {
  return ADAPTERS[name];
}

const DEFAULT_LADDERS: Record<Lane, ProviderName[]> = {
  classification: ["groq", "gemini"],
  synthesis: ["gemini", "groq", "openrouter"],
};

const LANE_ENV: Record<Lane, string> = {
  classification: "CLASSIFICATION_PROVIDERS",
  synthesis: "SYNTHESIS_PROVIDERS",
};

/** The lane's provider order, from env when set (comma-separated names). */
export function laneLadder(lane: Lane): ProviderName[] {
  const raw = process.env[LANE_ENV[lane]];
  if (!raw) return DEFAULT_LADDERS[lane];
  const names = raw
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .filter(isProviderName);
  return names.length > 0 ? names : DEFAULT_LADDERS[lane];
}

export interface LaneResult {
  text: string;
  provider: ProviderName;
  model: string;
}

/**
 * Walk the lane's ladder until one provider answers.
 *
 * Throws ProvidersUnavailable when every provider is exhausted (callers
 * degrade), or ProviderModelDead the moment a configured model turns out to
 * be unusable (callers must NOT swallow this).
 */
export async function generateForLane(
  lane: Lane,
  prompt: string,
  opts: GenerateOptions = {},
): Promise<LaneResult> {
  const ladder = laneLadder(lane);
  const skipped: string[] = [];

  for (const name of ladder) {
    const adapter = ADAPTERS[name];
    if (!adapter.configured()) {
      skipped.push(`${name}:unconfigured`);
      continue;
    }
    if (isBenched(name)) {
      skipped.push(`${name}:benched`);
      continue;
    }

    try {
      // Preflight is memoized per provider+lane+model, so this is a no-op
      // after the first successful call on the instance.
      await adapter.preflight(lane);
      const text = await adapter.generate(lane, prompt, opts);
      return { text, provider: name, model: adapter.modelFor(lane) };
    } catch (err) {
      if (err instanceof ProviderModelDead) {
        // Deploy bug, not a quota event — abort the lane loudly.
        logEvent({
          evt: "provider_model_dead",
          lane,
          provider: err.provider,
          model: err.model,
          detail: err.detail,
        });
        throw err;
      }
      if (err instanceof ProviderRateLimited) {
        if (err.daily) benchProviderForDay(name);
        else benchProvider(name, err.retryMs, "rate-limit");
        skipped.push(`${name}:${err.daily ? "daily-quota" : "rate-limited"}`);
        continue;
      }
      if (err instanceof ProviderTransient) {
        benchProvider(name, 30_000, "transient");
        skipped.push(`${name}:transient`);
        continue;
      }
      // Anything else is a genuine bug in the adapter — surface it.
      throw err;
    }
  }

  logEvent({ evt: "lane_exhausted", lane, ladder, skipped });
  throw new ProvidersUnavailable(
    `every ${lane} provider is unavailable (${skipped.join(", ") || "none configured"})`,
  );
}

export interface LaneProviderHealth {
  provider: ProviderName;
  model: string;
  configured: boolean;
  available: boolean;
  preflight: string;
  preflight_detail: string | null;
  calls_today: number;
  errors_today: number;
  benched_until: string | null;
  bench_reason: string | null;
}

/** /api/health: the lane's ladder, in order, with each provider's status. */
export function laneHealth(lane: Lane): LaneProviderHealth[] {
  return laneLadder(lane).map((name) => {
    const adapter = ADAPTERS[name];
    const model = adapter.modelFor(lane);
    const pf = preflightStatus(name, lane, model);
    const snap = snapshot(name);
    return {
      provider: name,
      model,
      configured: adapter.configured(),
      available: adapter.configured() && !snap.benched && pf.status !== "dead",
      preflight: pf.status,
      preflight_detail: pf.detail,
      calls_today: snap.calls_today,
      errors_today: snap.errors_today,
      benched_until: snap.benched_until,
      bench_reason: snap.bench_reason,
    };
  });
}

export {
  ProviderModelDead,
  ProviderRateLimited,
  ProviderTransient,
  ProvidersUnavailable,
  type Lane,
  type ProviderName,
};
