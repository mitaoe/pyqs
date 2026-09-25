import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { _resetCacheForTests, cacheKey } from "../src/lib/rag/cache";
import { PROSE_WORDS_EXPLAIN, PROSE_WORDS_STRATEGY, SKIP_TAIL_MAX_EXAMS } from "../src/lib/rag/config";
import { closePool, getPool } from "../src/lib/rag/db";
import { checkResponseInvariants } from "../src/lib/rag/invariants";
import { _resetProviderRegistryForTests } from "../src/lib/rag/providers/registry";
import { adapterFor } from "../src/lib/rag/providers";
import { BANNED_PHRASES, checkAnswerQuality, skipContractViolation } from "../src/lib/rag/quality";
import { getSubjectStats } from "../src/lib/rag/subject-stats";
import type { AskResponse } from "../src/lib/rag/api-types";
import { POST } from "../src/app/api/ask/route";

/**
 * THE CROSS-PROVIDER ANSWER-QUALITY CONTRACT.
 *
 * The grounding / skip-safety / verdict-first / banned-phrase /
 * citation-format rules are properties of the ANSWER, not of Gemini. Once
 * synthesis can fall back to Groq or OpenRouter, a student can be served
 * prose no Gemini test ever looked at — so the same suite runs against each
 * provider's real output, by pinning SYNTHESIS_PROVIDERS to one provider at
 * a time and driving the actual /api/ask route end to end.
 *
 * Live network + live DB: each provider is skipped when its key is absent.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const SUBJECT = "Computer Networks";

/** A skip question, so the skip contract is in force. */
const STUDY_QUESTION = "which topics can I skip if I'm short on time?";
/** An open content question, so citations and grounding are in force. */
const SEMANTIC_QUESTION = "Explain the difference between TCP and UDP.";

const PROVIDERS = ["gemini", "groq", "openrouter"] as const;

const savedEnv = {
  synthesis: process.env.SYNTHESIS_PROVIDERS,
  synthLimit: process.env.RATE_LIMIT_SYNTH_PER_HOUR,
  totalLimit: process.env.RATE_LIMIT_TOTAL_PER_HOUR,
};

/**
 * OpenRouter's free models live in a shared upstream pool and fail by
 * HANGING, not erroring — measured at roughly 2 successes in 3. The contract
 * is about the prose a provider produces, so a flaky attempt is retried
 * rather than counted as a pass: only a provider that never answers is
 * reported as unexercised.
 */
const ATTEMPTS = 3;

async function ask(provider: string, question: string): Promise<AskResponse> {
  process.env.SYNTHESIS_PROVIDERS = provider;
  let body: AskResponse | null = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // Every provider must answer the question itself — no reading another
    // provider's cached answer back — and a bench from a previous attempt
    // must not skip the provider under test.
    _resetCacheForTests();
    _resetProviderRegistryForTests();
    const k = cacheKey(SUBJECT, question);
    await getPool().query("DELETE FROM response_cache WHERE cache_key = $1", [k.key]);

    const res = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: SUBJECT, question }),
      }),
    );
    body = (await res.json()) as AskResponse;
    expect(res.status, `HTTP ${res.status} from ${provider}`).toBe(200);
    if (!body.degraded) return body;
  }
  return body as AskResponse;
}

/** Shape rules every synthesized answer obeys, whoever wrote it. */
function expectProseContract(answer: string, maxWords: number) {
  const verdict = checkAnswerQuality(answer, { maxWords });
  // Split the report so a failure says which rule broke, not just "not ok".
  expect(verdict.problems.filter((p) => p.startsWith("banned phrase"))).toEqual([]);
  expect(verdict.problems.filter((p) => p.startsWith("missing bold verdict"))).toEqual([]);
  expect(verdict.problems.filter((p) => p.startsWith("too long"))).toEqual([]);
  for (const re of BANNED_PHRASES) expect(answer).not.toMatch(re);
  // Both prompts forbid tables; the ranked table under the answer already
  // carries the detail. gpt-oss appends one anyway, so it is stripped
  // server-side — assert none survives, whoever wrote the prose.
  expect(answer, "markdown table duplicates the ranked data").not.toMatch(
    /\n[ \t]*\|[ \t]*:?-{2,}/,
  );
}

/** No internal prompt vocabulary may reach a student, on any provider. */
function expectNoInternalVocab(answer: string) {
  expect(answer).not.toMatch(/topic_weightage_data|rarely_asked_topics|retrieved_questions/i);
  expect(answer).not.toMatch(/<\/?(?:conversation|student_question)>/i);
}

/**
 * The citation contract: square brackets around exactly ONE number, and only
 * numbers that actually index a retrieved question.
 */
function expectCitationContract(answer: string, citationCount: number) {
  expect(answer).not.toMatch(/\[\d+\s*,\s*\d+/); // "[1, 5]"
  expect(answer).not.toMatch(/\[\d+\s+and\s+\d+\]/i); // "[1 and 5]"
  // Non-ASCII bracket forms reach the renderer as plain text and silently
  // kill every source link. gpt-oss really does emit these.
  expect(answer, "full-width brackets must be normalized").not.toMatch(
    /[\u3010\u3011\uFF3B\uFF3D\u2045\u2046]/,
  );
  const refs = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  // Without this the loop below is vacuous — an answer citing nothing (or
  // citing in a shape we failed to parse) would pass silently.
  expect(refs.length, "answer must carry at least one [n] citation").toBeGreaterThan(0);
  for (const n of refs) {
    expect(n, `citation [${n}] outside 1..${citationCount}`).toBeGreaterThanOrEqual(1);
    expect(n, `citation [${n}] outside 1..${citationCount}`).toBeLessThanOrEqual(citationCount);
  }
}

describe.skipIf(!hasDb)("cross-provider answer-quality contract (live)", () => {
  beforeAll(() => {
    // These tests are the point of the run; don't let the per-hour synthesis
    // cap starve the later providers.
    process.env.RATE_LIMIT_SYNTH_PER_HOUR = "100";
    process.env.RATE_LIMIT_TOTAL_PER_HOUR = "1000";
  });

  afterEach(() => _resetProviderRegistryForTests());

  afterAll(async () => {
    if (savedEnv.synthesis) process.env.SYNTHESIS_PROVIDERS = savedEnv.synthesis;
    else delete process.env.SYNTHESIS_PROVIDERS;
    if (savedEnv.synthLimit) process.env.RATE_LIMIT_SYNTH_PER_HOUR = savedEnv.synthLimit;
    else delete process.env.RATE_LIMIT_SYNTH_PER_HOUR;
    if (savedEnv.totalLimit) process.env.RATE_LIMIT_TOTAL_PER_HOUR = savedEnv.totalLimit;
    else delete process.env.RATE_LIMIT_TOTAL_PER_HOUR;
    await closePool();
  });

  for (const provider of PROVIDERS) {
    const configured = adapterFor(provider).configured();

    describe.skipIf(!configured)(`${provider} synthesis`, () => {
      it("STUDY_GUIDE: verdict-first, in-cap, unbanned, skip-safe, grounded", async () => {
        const body = await ask(provider, STUDY_QUESTION);
        console.log(
          `\n===== ${provider.toUpperCase()} / STUDY_GUIDE =====\n${body.answer}\n===== end =====\n`,
        );

        // Still degraded after every attempt: honest availability, but no
        // prose to judge. Say so loudly rather than passing silently.
        if (body.degraded) {
          console.warn(
            `${provider}: degraded after ${ATTEMPTS} attempts — prose contract NOT exercised`,
          );
          return;
        }

        expect(body.intent).toBe("STUDY_GUIDE");
        expectProseContract(body.answer, PROSE_WORDS_STRATEGY);
        expectNoInternalVocab(body.answer);

        // SKIP SAFETY — the invariant with real stakes: telling a student to
        // skip a topic that is asked every year.
        const topics = body.topics ?? [];
        expect(topics.length).toBeGreaterThan(0);
        const protectedTopics = topics
          .filter((t) => t.exam_count > SKIP_TAIL_MAX_EXAMS)
          .map((t) => t.topic);
        expect(skipContractViolation(body.answer, protectedTopics)).toBeNull();
        expect(body.answer).toMatch(/not skippable/i);
        for (const c of body.skip_candidates ?? []) {
          expect(c.exam_count).toBeLessThanOrEqual(SKIP_TAIL_MAX_EXAMS);
        }

        // GROUNDING: counts quoted in prose must exist in the data, never be
        // invented. Every "N of M exams" pair must be a real row.
        const validCounts = new Set(topics.map((t) => t.exam_count));
        const quoted = [...body.answer.matchAll(/\*\*(\d+)\*\*\s+of\s+(\d+)/g)];
        for (const m of quoted) {
          expect(Number(m[2]), "denominator must be the subject's exam total").toBe(
            body.total_exams,
          );
          expect(
            validCounts.has(Number(m[1])) ||
              (body.skip_candidates ?? []).some((c) => c.exam_count === Number(m[1])),
            `quoted count ${m[1]} is not in the data`,
          ).toBe(true);
        }

        // The full server-side invariant gate, provider-independent.
        const stats = await getSubjectStats(SUBJECT);
        expect(
          checkResponseInvariants(body as Record<string, unknown>, {
            stats,
            filtersActive: false,
          }),
        ).toEqual([]);
      }, 180_000);

      it("SEMANTIC: verdict-first, in-cap, unbanned, citations well-formed", async () => {
        const body = await ask(provider, SEMANTIC_QUESTION);
        console.log(
          `\n===== ${provider.toUpperCase()} / SEMANTIC =====\n${body.answer}\n===== end =====\n`,
        );

        if (body.degraded) {
          console.warn(
            `${provider}: degraded after ${ATTEMPTS} attempts — prose contract NOT exercised`,
          );
          return;
        }

        expect(body.intent).toBe("SEMANTIC");
        const citations = body.citations ?? [];
        expect(citations.length).toBeGreaterThan(0);

        expectProseContract(body.answer, PROSE_WORDS_EXPLAIN);
        expectNoInternalVocab(body.answer);
        expectCitationContract(body.answer, citations.length);

        // Subject isolation holds no matter who wrote the prose.
        for (const c of citations) expect(c.standard_subject).toBe(SUBJECT);

        const stats = await getSubjectStats(SUBJECT);
        expect(
          checkResponseInvariants(body as Record<string, unknown>, {
            stats,
            filtersActive: false,
          }),
        ).toEqual([]);
      }, 180_000);
    });
  }
});
