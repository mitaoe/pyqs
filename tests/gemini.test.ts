import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { generateText, geminiPreflight, GEMINI_MODEL } from "../src/lib/rag/gemini";
import {
  _resetKeyRotatorForTests,
  acquireKey,
  benchKey,
  keyAvailability,
} from "../src/lib/rag/key-rotator";
import { generateForLane } from "../src/lib/rag/providers";
import {
  _resetProviderRegistryForTests,
  isBenched,
  preflightStatus,
  snapshot,
} from "../src/lib/rag/providers/registry";
import {
  ProviderModelDead,
  ProviderTransient,
  ProvidersUnavailable,
} from "../src/lib/rag/providers/types";

/**
 * Deterministic coverage of the Gemini client's failure handling, with fetch
 * stubbed — the same approach as providers.test.ts for the OpenAI-compatible
 * adapter. Every "answer that is not an answer" must come back as
 * ProviderTransient so the router can move on; a raw Error escapes the router
 * and turns /api/ask into a 500.
 */

const GROQ_MODEL = "test/groq-synth";
const ENV_KEYS = [
  "GEMINI_API_KEYS",
  "GROQ_API_KEY",
  "GROQ_SYNTHESIS_MODEL",
  "SYNTHESIS_PROVIDERS",
] as const;

const realFetch = globalThis.fetch;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
let generateQueue: (() => Response)[] = [];

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

const candidate = (text: string, finishReason = "STOP") =>
  jsonResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });

/** A body that starts arriving, then dies — what a timeout mid-read looks like. */
function abortedBody(status = 200): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"candidates":[{"content":'));
      controller.error(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    },
  });
  return new Response(stream, { status });
}

/** Which key each Gemini request used, in order. */
let geminiRequests: { kind: "preflight" | "generate"; key: string }[] = [];

function stubFetch(
  generate: (() => Response)[],
  preflight: (key: string) => Response = () => jsonResponse({ name: "models/test" }),
) {
  generateQueue = [...generate];
  geminiRequests = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("generativelanguage.googleapis.com")) {
      const key = new URL(url).searchParams.get("key") ?? "";
      if (url.includes(":generateContent")) {
        geminiRequests.push({ kind: "generate", key });
        const next = generateQueue.shift();
        if (!next) throw new Error("stub exhausted");
        return next();
      }
      geminiRequests.push({ kind: "preflight", key });
      return preflight(key); // model metadata GET
    }
    if (url.endsWith("/models")) return jsonResponse({ data: [{ id: GROQ_MODEL }] });
    if (url.endsWith("/chat/completions")) {
      return jsonResponse({
        choices: [{ message: { content: "written by groq" }, finish_reason: "stop" }],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
}

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.GEMINI_API_KEYS = "key-a,key-b";
  _resetKeyRotatorForTests();
  _resetProviderRegistryForTests();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  _resetKeyRotatorForTests();
  _resetProviderRegistryForTests();
});

describe("Gemini answers that are not answers", () => {
  it("returns a normal answer untouched", async () => {
    stubFetch([() => candidate("**Paging** splits memory into frames.")]);
    await expect(generateText("p")).resolves.toBe("**Paging** splits memory into frames.");
    expect(snapshot("gemini").errors_today).toBe(0);
  });

  it("a body that aborts mid-read is transient, not a raw error", async () => {
    stubFetch([() => abortedBody()]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(snapshot("gemini").last_outcome).toBe("body_read_error");
  });

  it("a malformed JSON body is transient", async () => {
    stubFetch([() => new Response("{ truncated json", { status: 200 })]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
  });

  it("an empty candidate is transient", async () => {
    stubFetch([() => candidate("   ")]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(snapshot("gemini").last_outcome).toBe("empty");
  });

  it("a response with no candidates at all is transient", async () => {
    stubFetch([() => jsonResponse({})]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
  });

  it("a blocked prompt is transient", async () => {
    stubFetch([() => jsonResponse({ promptFeedback: { blockReason: "SAFETY" } })]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(snapshot("gemini").last_outcome).toBe("blocked_safety");
  });

  it("a safety-cut fragment is never served, even with text in it", async () => {
    stubFetch([() => candidate("**Paging** splits memory into", "SAFETY")]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
  });

  it("a truncated answer is refused", async () => {
    stubFetch([() => candidate("**Learn paging first.** Then drill", "MAX_TOKENS")]);
    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(snapshot("gemini").last_outcome).toBe("truncated");
  });

  it("an unreadable ERROR body does not escape either", async () => {
    stubFetch([() => abortedBody(503), () => candidate("recovered")]);
    await expect(generateText("p")).resolves.toBe("recovered");
  });
});

describe("the lane degrades instead of 500ing", () => {
  it("the router hands an empty Gemini answer to the next provider", async () => {
    process.env.SYNTHESIS_PROVIDERS = "gemini,groq";
    process.env.GROQ_API_KEY = "k";
    process.env.GROQ_SYNTHESIS_MODEL = GROQ_MODEL;
    stubFetch([() => candidate("")]);

    const res = await generateForLane("synthesis", "p");
    expect(res.provider).toBe("groq");
    expect(res.text).toBe("written by groq");
  });

  it("with Gemini alone, an unreadable body exhausts the lane — the route's degrade signal", async () => {
    process.env.SYNTHESIS_PROVIDERS = "gemini";
    stubFetch([() => abortedBody()]);

    await expect(generateForLane("synthesis", "p")).rejects.toBeInstanceOf(ProvidersUnavailable);
  });
});

describe("preflight: a rejected key is benched, not a dead provider", () => {
  const rejectKeyA = (key: string) =>
    key === "key-a"
      ? jsonResponse({ error: { code: 400, message: "API key not valid." } }, 400)
      : jsonResponse({ name: "models/test" });

  /** The rotator starts at a random key; advance it so key-a is served next. */
  function sampleKeyANext() {
    while (acquireKey().index !== 1);
  }

  it("benches the rejected key and passes the check with the next one", async () => {
    stubFetch([], rejectKeyA);
    sampleKeyANext();

    await expect(geminiPreflight()).resolves.toBeUndefined();
    expect(geminiRequests.map((r) => r.key)).toEqual(["key-a", "key-b"]);
    expect(keyAvailability()).toEqual({ total: 2, available: 1, benched: 1 });
  });

  it("through the router, the lane stays alive and answers with the good key", async () => {
    process.env.SYNTHESIS_PROVIDERS = "gemini";
    stubFetch([() => candidate("**Paging** splits memory into frames.")], rejectKeyA);
    sampleKeyANext();

    const res = await generateForLane("synthesis", "p");
    expect(res.provider).toBe("gemini");
    expect(preflightStatus("gemini", "synthesis", GEMINI_MODEL).status).toBe("ok");
    expect(geminiRequests.find((r) => r.kind === "generate")?.key).toBe("key-b");
  });

  it("a single-key deployment whose key is rejected still aborts loudly", async () => {
    process.env.GEMINI_API_KEYS = "key-a";
    _resetKeyRotatorForTests();
    stubFetch([], rejectKeyA);

    await expect(geminiPreflight()).rejects.toBeInstanceOf(ProviderModelDead);
  });

  it("every key rejected is a misconfiguration and aborts loudly", async () => {
    stubFetch([], () => jsonResponse({ error: { message: "PERMISSION_DENIED" } }, 403));

    const err = await geminiPreflight().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderModelDead);
    expect((err as Error).message).toMatch(/every key in GEMINI_API_KEYS was rejected \(2 of 2/);
  });

  it("one key out of quota and the other rejected is a quota event, not a dead provider", async () => {
    stubFetch([], rejectKeyA);
    benchKey(1, 60_000); // key-b cooling down on a per-minute 429

    await expect(geminiPreflight()).rejects.toBeInstanceOf(ProvidersUnavailable);
  });

  it("a 404 still means the model is dead, whichever key asked", async () => {
    stubFetch([], () => jsonResponse({ error: { message: "not found" } }, 404));

    await expect(geminiPreflight()).rejects.toBeInstanceOf(ProviderModelDead);
    expect(geminiRequests).toHaveLength(1);
  });
});

describe("upstream 5xx: Gemini overloaded", () => {
  // The real body, seen live on 2026-09-22 when the model was saturated.
  const unavailable = () =>
    jsonResponse(
      {
        error: {
          code: 503,
          status: "UNAVAILABLE",
          message: "This model is currently experiencing high demand.",
        },
      },
      503,
    );

  it("retries the first 5xx on the next key — a spike can be local to one backend", async () => {
    stubFetch([unavailable, () => candidate("recovered")]);

    await expect(generateText("p")).resolves.toBe("recovered");
    const used = geminiRequests.filter((r) => r.kind === "generate").map((r) => r.key);
    expect(used).toHaveLength(2);
    expect(used[0]).not.toBe(used[1]);
  });

  it("a REPEATED 5xx is transient, not a raw error", async () => {
    stubFetch([unavailable, unavailable]);

    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(snapshot("gemini").last_outcome).toBe("error_503");
  });

  it("benches no key — an overloaded model is not a bad key", async () => {
    stubFetch([unavailable, unavailable]);

    await expect(generateText("p")).rejects.toBeInstanceOf(ProviderTransient);
    expect(keyAvailability()).toEqual({ total: 2, available: 2, benched: 0 });
  });

  it("the router falls through to the next provider instead of aborting the lane", async () => {
    process.env.SYNTHESIS_PROVIDERS = "gemini,groq";
    process.env.GROQ_API_KEY = "k";
    process.env.GROQ_SYNTHESIS_MODEL = GROQ_MODEL;
    stubFetch([unavailable, unavailable]);

    const res = await generateForLane("synthesis", "p");
    expect(res.provider).toBe("groq");
    expect(res.text).toBe("written by groq");
    expect(isBenched("gemini")).toBe(true); // benched briefly, not marked dead
    expect(preflightStatus("gemini", "synthesis", GEMINI_MODEL).status).not.toBe("dead");
  });

  it("with Gemini alone it exhausts the lane — the route's degrade signal, never a 500", async () => {
    process.env.SYNTHESIS_PROVIDERS = "gemini";
    stubFetch([unavailable, unavailable]);

    await expect(generateForLane("synthesis", "p")).rejects.toBeInstanceOf(ProvidersUnavailable);
  });
});
