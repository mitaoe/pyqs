import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpenAICompatAdapter } from "../src/lib/rag/providers/openai-compat";
import {
  _resetProviderRegistryForTests,
  benchProviderForDay,
  isBenched,
  snapshot,
} from "../src/lib/rag/providers/registry";
import {
  ProviderModelDead,
  ProviderRateLimited,
  ProviderTransient,
} from "../src/lib/rag/providers/types";

/**
 * Deterministic coverage of the failure taxonomy, with fetch stubbed — the
 * live contract tests can't reach these branches on demand (you cannot ask a
 * provider for a daily-quota 429), and reproducing them for real burns the
 * very quota under test.
 */

const MODEL = "test/model-a";

const adapter = createOpenAICompatAdapter({
  name: "groq",
  baseUrl: "https://provider.test/v1",
  apiKeyEnv: "TEST_PROVIDER_KEY",
  models: {
    classification: { env: "TEST_CLASSIFICATION_MODEL", fallback: MODEL },
    synthesis: { env: "TEST_SYNTHESIS_MODEL", fallback: "test/model-b" },
  },
  reasoningEffort: "low",
  maxTimeoutMs: 5_000,
});

const realFetch = globalThis.fetch;
let calls: { url: string; body: Record<string, unknown> }[] = [];

/** Queue of responses; the catalog GET is answered automatically. */
function stubFetch(responses: (() => Response)[]) {
  const queue = [...responses];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: MODEL }, { id: "test/model-b" }] }), {
        status: 200,
      });
    }
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    const next = queue.shift();
    if (!next) throw new Error("stub exhausted");
    return next();
  }) as typeof fetch;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

const completion = (content: string, finish = "stop") =>
  jsonResponse({ choices: [{ message: { content }, finish_reason: finish }] });

beforeEach(() => {
  _resetProviderRegistryForTests();
  calls = [];
  process.env.TEST_PROVIDER_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TEST_PROVIDER_KEY;
  delete process.env.TEST_CLASSIFICATION_MODEL;
});

describe("OpenAI-compatible adapter", () => {
  it("is unconfigured without its key, so the router skips it", () => {
    expect(adapter.configured()).toBe(true);
    delete process.env.TEST_PROVIDER_KEY;
    expect(adapter.configured()).toBe(false);
  });

  it("resolves the model from env at call time, per lane", () => {
    expect(adapter.modelFor("classification")).toBe(MODEL);
    expect(adapter.modelFor("synthesis")).toBe("test/model-b");
    process.env.TEST_CLASSIFICATION_MODEL = "test/override";
    expect(adapter.modelFor("classification")).toBe("test/override");
  });

  it("returns the completion text and counts the call", async () => {
    stubFetch([() => completion("hello")]);
    await expect(adapter.generate("classification", "hi", {})).resolves.toBe("hello");
    expect(snapshot("groq").calls_today).toBe(1);
    expect(snapshot("groq").errors_today).toBe(0);
  });

  it("adds the word 'json' when JSON mode needs it, and never twice", async () => {
    stubFetch([() => completion("{}"), () => completion("{}")]);
    await adapter.generate("classification", "classify this", { json: true });
    const sent = (calls[0].body.messages as { content: string }[])[0].content;
    expect(sent.toLowerCase()).toContain("json");
    expect(sent).toMatch(/^classify this/);
    expect((calls[0].body as { response_format?: unknown }).response_format).toEqual({
      type: "json_object",
    });

    await adapter.generate("classification", "Reply with one JSON object", { json: true });
    const msgs = (calls[1].body.messages as { content: string }[])[0].content;
    expect(msgs).toBe("Reply with one JSON object"); // already mentions it — untouched
  });

  it("clamps the timeout to the provider's ceiling", async () => {
    // 45s requested, 5s ceiling: an AbortSignal that fires at 5s proves the
    // clamp without waiting for either.
    stubFetch([() => completion("ok")]);
    await adapter.generate("synthesis", "p", { timeoutMs: 45_000 });
    expect(calls.length).toBe(1); // sanity: the call went out under the stub
  });
});

describe("429 handling: per-minute cools down, daily benches for the day", () => {
  const rateLimited = (message: string, retryAfter?: string) =>
    new Response(JSON.stringify({ error: { message } }), {
      status: 429,
      headers: retryAfter ? { "retry-after": retryAfter } : {},
    });

  it("treats a per-minute limit as a short cooldown", async () => {
    stubFetch([() => rateLimited("Rate limit reached, please try again in 7.66s")]);
    const err = await adapter.generate("classification", "p", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderRateLimited);
    expect((err as ProviderRateLimited).daily).toBe(false);
    expect((err as ProviderRateLimited).retryMs).toBeLessThan(60_000);
  });

  it("honors Retry-After", async () => {
    stubFetch([() => rateLimited("slow down", "12")]);
    const err = (await adapter
      .generate("classification", "p", {})
      .catch((e) => e)) as ProviderRateLimited;
    expect(err.retryMs).toBe(13_000);
  });

  it.each([
    "Rate limit reached for model X on requests per day (RPD)",
    "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
    "You have exceeded your daily quota",
  ])("recognises a daily limit: %s", async (message) => {
    stubFetch([() => rateLimited(message)]);
    const err = (await adapter
      .generate("classification", "p", {})
      .catch((e) => e)) as ProviderRateLimited;
    expect(err).toBeInstanceOf(ProviderRateLimited);
    expect(err.daily).toBe(true);
  });

  it("a day-bench survives until the next UTC day", () => {
    benchProviderForDay("openrouter");
    expect(isBenched("openrouter")).toBe(true);
    const until = new Date(snapshot("openrouter").benched_until!);
    expect(until.getTime()).toBeGreaterThan(Date.now());
    expect(until.toISOString().slice(11, 16)).toBe("00:00");
    expect(snapshot("openrouter").bench_reason).toBe("daily-quota");
  });
});

describe("a dead model aborts loudly instead of degrading", () => {
  it("404 model_not_found is ProviderModelDead, not a quota event", async () => {
    stubFetch([
      () =>
        jsonResponse(
          { error: { message: "The model `test/model-a` does not exist", code: "model_not_found" } },
          404,
        ),
    ]);
    const err = await adapter.generate("classification", "p", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderModelDead);
    expect(err).not.toBeInstanceOf(ProviderRateLimited);
  });

  it("a rejected key is ProviderModelDead and names the env var to fix", async () => {
    stubFetch([() => jsonResponse({ error: { message: "invalid api key" } }, 401)]);
    const err = (await adapter
      .generate("classification", "p", {})
      .catch((e) => e)) as ProviderModelDead;
    expect(err).toBeInstanceOf(ProviderModelDead);
    expect(err.detail).toContain("TEST_PROVIDER_KEY");
  });

  it("the dead verdict is sticky — preflight refuses without another call", async () => {
    stubFetch([() => jsonResponse({ error: { message: "gone" } }, 404)]);
    await adapter.generate("classification", "p", {}).catch(() => {});
    globalThis.fetch = (async () => {
      throw new Error("preflight must not call out again once a model is known dead");
    }) as typeof fetch;
    await expect(adapter.preflight("classification")).rejects.toBeInstanceOf(ProviderModelDead);
  });

  it("preflight fails when the model is missing from the catalog", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/models")) {
        return jsonResponse({ data: [{ id: "some/other-model" }] });
      }
      throw new Error("generate must not be reached");
    }) as typeof fetch;
    await expect(adapter.preflight("classification")).rejects.toBeInstanceOf(ProviderModelDead);
  });

  it("an unreachable catalog is transient, not dead — the verdict stays open", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    await expect(adapter.preflight("classification")).rejects.toBeInstanceOf(ProviderTransient);
    // Not memoized as dead: a later call retries the check.
    stubFetch([() => completion("recovered")]);
    await expect(adapter.generate("classification", "p", {})).resolves.toBe("recovered");
  });
});

describe("answers that are not answers", () => {
  it("an empty completion is transient — the next provider gets a turn", async () => {
    stubFetch([() => completion("")]);
    await expect(adapter.generate("classification", "p", {})).rejects.toBeInstanceOf(
      ProviderTransient,
    );
  });

  it("a truncated answer is refused: half a study plan is worse than none", async () => {
    stubFetch([() => completion("**Skip only the rarely-asked topics. Study IP Addr", "length")]);
    await expect(adapter.generate("synthesis", "p", {})).rejects.toBeInstanceOf(ProviderTransient);
  });

  it("an unreadable body degrades instead of escaping as a raw error", async () => {
    stubFetch([() => new Response("{ truncated json", { status: 200 })]);
    await expect(adapter.generate("synthesis", "p", {})).rejects.toBeInstanceOf(ProviderTransient);
  });

  it("retries once without reasoning_effort when the model rejects it", async () => {
    stubFetch([
      () =>
        jsonResponse(
          { error: { message: "`reasoning_effort` must be one of `none` or `default`" } },
          400,
        ),
      () => completion("second try"),
    ]);
    await expect(adapter.generate("classification", "p", {})).resolves.toBe("second try");
    expect(calls[0].body.reasoning_effort).toBe("low");
    expect(calls[1].body.reasoning_effort).toBeUndefined();
  });

  it("retries a 5xx before giving up", async () => {
    stubFetch([
      () => new Response("upstream boom", { status: 502 }),
      () => completion("recovered"),
    ]);
    await expect(adapter.generate("synthesis", "p", {})).resolves.toBe("recovered");
  });
});

describe("registry counters", () => {
  it("separates successful calls from errors, per provider", async () => {
    stubFetch([() => completion("a"), () => completion("")]);
    await adapter.generate("classification", "p", {});
    await adapter.generate("classification", "p", {}).catch(() => {});
    const snap = snapshot("groq");
    expect(snap.calls_today).toBe(2);
    expect(snap.errors_today).toBe(1);
    // A different provider's counters are untouched.
    expect(snapshot("openrouter").calls_today).toBe(0);
  });
});

describe("lane router", () => {
  it("falls to the next provider on a rate limit, and reports what it skipped", async () => {
    const saved = {
      groq: process.env.GROQ_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
      gemini: process.env.GEMINI_API_KEYS,
    };
    vi.resetModules();
    process.env.GROQ_API_KEY = "k";
    process.env.OPENROUTER_API_KEY = "k";
    process.env.GEMINI_API_KEYS = "";
    process.env.SYNTHESIS_PROVIDERS = "groq,openrouter";
    const { generateForLane } = await import("../src/lib/rag/providers");

    let call = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/models")) {
        return jsonResponse({
          data: [
            { id: "openai/gpt-oss-120b" },
            { id: "nvidia/nemotron-3-super-120b-a12b:free" },
          ],
        });
      }
      call++;
      if (url.includes("groq")) {
        return new Response(JSON.stringify({ error: { message: "requests per day (RPD)" } }), {
          status: 429,
        });
      }
      return completion("written by the fallback");
    }) as typeof fetch;

    const res = await generateForLane("synthesis", "p", {});
    expect(res.provider).toBe("openrouter");
    expect(res.text).toBe("written by the fallback");
    expect(call).toBe(2); // groq tried, then openrouter
    expect(isBenched("groq")).toBe(true);

    delete process.env.SYNTHESIS_PROVIDERS;
    for (const [k, v] of Object.entries({
      GROQ_API_KEY: saved.groq,
      OPENROUTER_API_KEY: saved.openrouter,
      GEMINI_API_KEYS: saved.gemini,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
});
