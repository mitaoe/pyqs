/**
 * One adapter for every OpenAI-compatible chat-completions endpoint.
 *
 * Groq and OpenRouter speak the same wire protocol (POST /chat/completions,
 * GET /models), so they are the SAME code with different base URLs, keys and
 * model ids — configured once in ./index.ts. Anything genuinely
 * provider-specific stays in the config object, never in a branch here.
 *
 * Two behaviours are worth calling out:
 *
 * 1. PREFLIGHT uses GET /models, not a throwaway completion. A dead model or
 *    a rejected key is caught without spending a single request of the day's
 *    quota, and the verdict is sticky per instance.
 * 2. `reasoning_effort` is sent optimistically (the gpt-oss models burn the
 *    whole token budget on reasoning without it) and dropped permanently for
 *    the instance the first time a model rejects it — the same sticky-fallback
 *    shape the Gemini client uses for thinkingConfig.
 */

import {
  ProviderModelDead,
  ProviderRateLimited,
  ProviderTransient,
  type GenerateOptions,
  type Lane,
  type ProviderAdapter,
  type ProviderName,
} from "./types";
import { preflightStatus, recordCall, setPreflight } from "./registry";

export interface OpenAICompatConfig {
  name: ProviderName;
  /** e.g. "https://api.groq.com/openai/v1" — no trailing slash. */
  baseUrl: string;
  /** Env var holding the API key. Absent => provider not configured. */
  apiKeyEnv: string;
  /**
   * Per-lane model id, resolved from env on EVERY call so an operator can
   * swap models without a redeploy (and tests can force one).
   */
  models: Record<Lane, { env: string; fallback: string }>;
  /** Static extras (OpenRouter's attribution headers). */
  headers?: Record<string, string>;
  /** Sent until a model rejects it; then dropped for the instance. */
  reasoningEffort?: string;
  /**
   * Hard ceiling on this provider's request timeout, regardless of what the
   * caller asks for. Free shared pools fail by HANGING rather than erroring,
   * and a rung deep in the ladder must not spend the whole request budget
   * waiting — leave room to fall through and degrade honestly.
   */
  maxTimeoutMs?: number;
}

/**
 * OpenAI-compatible JSON mode rejects any request whose messages don't
 * literally contain "json" ("'messages' must contain the word 'json' in some
 * form"). Our classification prompt happens to say "JSON object", but relying
 * on prompt wording to keep a provider alive is a trap: drop the word during
 * an edit and the whole lane silently falls through to the scarcer provider.
 * So the adapter guarantees it instead.
 */
function ensureJsonMentioned(prompt: string): string {
  return /json/i.test(prompt)
    ? prompt
    : `${prompt}\n\nReply with a single JSON object and nothing else.`;
}

/** Free tiers phrase daily exhaustion differently; per-minute is the default. */
const DAILY_LIMIT_RE = /per\s*-?\s*day|\bRPD\b|\bTPD\b|daily\s+(?:quota|limit)|free-models-per-day/i;

/** "Please try again in 7.66s" / Retry-After: 30 */
function retryMsFrom(resp: Response, body: string): number {
  const header = resp.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs * 1000) + 1000;
  }
  const m = /try again in\s+([\d.]+)\s*s/i.exec(body);
  if (m) return Math.ceil(Number(m[1]) * 1000) + 1000;
  return 30_000;
}

/** Key indexes/models only — never key values (same contract as Gemini). */
function logCall(provider: ProviderName, lane: Lane, model: string, outcome: string): void {
  console.log(JSON.stringify({ evt: "provider_call", provider, lane, model, outcome }));
}

export function createOpenAICompatAdapter(config: OpenAICompatConfig): ProviderAdapter {
  // Sticky per instance: once a model rejects reasoning_effort, stop sending it.
  let sendReasoningEffort = Boolean(config.reasoningEffort);

  const apiKey = () => process.env[config.apiKeyEnv]?.trim() || "";

  const headers = () => ({
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    ...config.headers,
  });

  const modelFor = (lane: Lane) =>
    process.env[config.models[lane].env]?.trim() || config.models[lane].fallback;

  return {
    name: config.name,
    modelFor,
    configured: () => apiKey().length > 0,

    async preflight(lane: Lane): Promise<void> {
      const model = modelFor(lane);
      const cached = preflightStatus(config.name, lane, model);
      if (cached.status === "ok") return;
      if (cached.status === "dead") {
        throw new ProviderModelDead(config.name, model, cached.detail ?? "preflight failed");
      }

      let resp: Response;
      try {
        resp = await fetch(`${config.baseUrl}/models`, {
          headers: headers(),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        // Can't reach the catalog: transient, NOT a dead model. Leave the
        // verdict "unknown" so the next call retries the check.
        throw new ProviderTransient(
          `${config.name} preflight unreachable (${err instanceof Error ? err.name : "network"})`,
          config.name,
        );
      }

      if (resp.status === 401 || resp.status === 403) {
        const detail = `key rejected (HTTP ${resp.status}) — check ${config.apiKeyEnv}`;
        setPreflight(config.name, lane, model, "dead", detail);
        throw new ProviderModelDead(config.name, model, detail);
      }
      if (!resp.ok) {
        throw new ProviderTransient(
          `${config.name} preflight HTTP ${resp.status}`,
          config.name,
        );
      }

      const body = (await resp.json()) as { data?: { id?: string }[] };
      const ids = (body.data ?? []).map((m) => m.id).filter(Boolean) as string[];
      if (ids.length > 0 && !ids.includes(model)) {
        const detail = `model not in ${config.name}'s catalog for this key (${ids.length} models listed)`;
        setPreflight(config.name, lane, model, "dead", detail);
        console.error(
          JSON.stringify({ evt: "provider_preflight_failed", provider: config.name, lane, model, detail }),
        );
        throw new ProviderModelDead(config.name, model, detail);
      }
      setPreflight(config.name, lane, model, "ok");
    },

    async generate(lane: Lane, prompt: string, opts: GenerateOptions): Promise<string> {
      const model = modelFor(lane);
      const timeoutMs = Math.min(opts.timeoutMs ?? 30_000, config.maxTimeoutMs ?? Infinity);
      const maxTokens = opts.maxTokens ?? (lane === "classification" ? 800 : 2000);

      // One retry budget, spent on either dropping reasoning_effort or a 5xx.
      for (let attempt = 0; attempt < 3; attempt++) {
        const payload: Record<string, unknown> = {
          model,
          messages: [
            { role: "user", content: opts.json ? ensureJsonMentioned(prompt) : prompt },
          ],
          temperature: 0,
          max_tokens: maxTokens,
        };
        if (opts.json) payload.response_format = { type: "json_object" };
        if (sendReasoningEffort) payload.reasoning_effort = config.reasoningEffort;

        let resp: Response;
        try {
          resp = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (err) {
          recordCall(config.name, "network_error");
          logCall(config.name, lane, model, "network_error");
          throw new ProviderTransient(
            `${config.name} unreachable (${err instanceof Error ? err.name : "network error"})`,
            config.name,
          );
        }

        if (resp.ok) {
          // Reading the body can ALSO abort on the timeout signal — a slow
          // free-tier stream trickling tokens past the deadline throws here,
          // not at fetch(). Left unwrapped it escapes as a raw DOMException
          // and the route 500s instead of falling to the next provider.
          let body: {
            choices?: { message?: { content?: string }; finish_reason?: string }[];
          };
          try {
            body = (await resp.json()) as typeof body;
          } catch (err) {
            recordCall(config.name, "body_read_error");
            logCall(config.name, lane, model, "body_read_error");
            throw new ProviderTransient(
              `${config.name} response unreadable (${err instanceof Error ? err.name : "stream error"})`,
              config.name,
            );
          }
          const choice = body.choices?.[0];
          const text = (choice?.message?.content ?? "").trim();
          // Truncated mid-sentence: half an answer is worse than falling
          // through to a provider that can finish one.
          if (choice?.finish_reason === "length" && text) {
            recordCall(config.name, "truncated");
            logCall(config.name, lane, model, "truncated");
            throw new ProviderTransient(
              `${config.name} truncated its answer at the token cap`,
              config.name,
            );
          }
          if (!text) {
            // Reasoning models can spend the whole budget thinking. Treat an
            // empty completion as transient — the next provider will answer.
            recordCall(config.name, "empty");
            logCall(config.name, lane, model, "empty");
            throw new ProviderTransient(`${config.name} returned an empty completion`, config.name);
          }
          recordCall(config.name, "ok");
          logCall(config.name, lane, model, "ok");
          return text;
        }

        // Same hazard on the error path: never let a body read escape raw.
        let errText: string;
        try {
          errText = await resp.text();
        } catch {
          errText = "";
        }

        // Model doesn't take reasoning_effort (or takes different values) —
        // drop it for this instance and retry immediately.
        if (resp.status === 400 && sendReasoningEffort && /reasoning_effort/i.test(errText)) {
          sendReasoningEffort = false;
          logCall(config.name, lane, model, "dropped_reasoning_effort");
          continue;
        }

        if (resp.status === 429) {
          const daily = DAILY_LIMIT_RE.test(errText);
          const retryMs = retryMsFrom(resp, errText);
          recordCall(config.name, daily ? "quota_daily" : "rate_limited");
          logCall(config.name, lane, model, daily ? "quota_daily" : `rate_limited_${Math.round(retryMs / 1000)}s`);
          throw new ProviderRateLimited(
            `${config.name} rate limited (${daily ? "daily quota" : "per-minute"})`,
            config.name,
            daily,
            retryMs,
          );
        }

        if (resp.status === 401 || resp.status === 403) {
          const detail = `key rejected (HTTP ${resp.status}) — check ${config.apiKeyEnv}`;
          setPreflight(config.name, lane, model, "dead", detail);
          recordCall(config.name, "rejected");
          logCall(config.name, lane, model, `rejected_${resp.status}`);
          throw new ProviderModelDead(config.name, model, detail);
        }

        if (resp.status === 404 || /model_not_found|does not exist/i.test(errText)) {
          const detail = `model not found (HTTP ${resp.status})`;
          setPreflight(config.name, lane, model, "dead", detail);
          recordCall(config.name, "model_not_found");
          console.error(
            JSON.stringify({ evt: "provider_model_dead", provider: config.name, lane, model, detail }),
          );
          throw new ProviderModelDead(config.name, model, detail);
        }

        if (resp.status >= 500) {
          logCall(config.name, lane, model, `server_${resp.status}`);
          if (attempt < 2) continue;
          recordCall(config.name, "server_error");
          throw new ProviderTransient(`${config.name} HTTP ${resp.status}`, config.name);
        }

        recordCall(config.name, `error_${resp.status}`);
        logCall(config.name, lane, model, `error_${resp.status}`);
        throw new ProviderTransient(
          `${config.name} HTTP ${resp.status}: ${errText.slice(0, 200)}`,
          config.name,
        );
      }

      throw new ProviderTransient(`${config.name} did not succeed after retries`, config.name);
    },
  };
}
