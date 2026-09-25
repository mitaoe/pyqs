import { NextResponse } from "next/server";

import {
  annotateCluster,
  availableYears,
  clusterSources,
  examCountForClusters,
  filterLabel,
  nearestYear,
  topClusters,
  topicClusters,
} from "@/lib/rag/analytics";
import {
  PREDICTION_DISCLAIMER,
  SOLUTION_CAUTION,
  formatAnalyticsAnswer,
  formatTopicAnalyticsAnswer,
  formatSkipFallback,
  formatTopicWeightageAnswer,
  formatYearTrendAnswer,
  guardOutput,
  normalizeCitations,
  stripContradictoryPreamble,
  stripInternalNames,
  stripRedundantTables,
  type SynthResult,
  synthesizeAnswer,
  synthesizeStudyGuide,
  synthesizeWithQuality,
} from "@/lib/rag/answer";
import { cacheGet, cacheKey, cacheSet } from "@/lib/rag/cache";
import {
  FIGURE_HEAVY_SHARE,
  MAX_TOPIC_CLUSTERS,
  MIN_GROUNDING_HITS,
  PROSE_WORDS_EXPLAIN,
  PROSE_WORDS_STRATEGY,
  SEMANTIC_MIN_SIMILARITY,
} from "@/lib/rag/config";
import { embedQuery } from "@/lib/rag/embed";
import { EmbeddingsUnavailable } from "@/lib/rag/vector";
import { GeminiUnavailable } from "@/lib/rag/gemini";
import {
  NUMBERED_REF,
  UNRESOLVED_REF,
  classificationFromClient,
  classifyIntent,
  coerceClassification,
  extractExamType,
  extractTopicShape,
  extractYear,
  isExhaustiveQuery,
  isSkipQuery,
  resolveNumberedRef,
  type HistoryTurn,
} from "@/lib/rag/intent";
import { normalizeQuery } from "@/lib/rag/normalize";
import { checkResponseInvariants } from "@/lib/rag/invariants";
import { logEvent } from "@/lib/rag/obs";
import { skipContractViolation } from "@/lib/rag/quality";
import { getSubjectStats, isSmallCorpus } from "@/lib/rag/subject-stats";
import { consume, ipFromHeaders, rateKey, synthLimit, totalLimit } from "@/lib/rag/ratelimit";
import { greetingMessage, isGreeting, prefilterAbuse, refusalMessage } from "@/lib/rag/scope";
import { semanticSearch } from "@/lib/rag/search";
import { subjectExists } from "@/lib/rag/subjects";
import {
  labelClusters,
  labelExamCount,
  matchTopicLabel,
  topicQuestions,
  topicStats,
  topicTail,
  topicWeightage,
  totalExams,
} from "@/lib/rag/topics";
import { yearTrend } from "@/lib/rag/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cold start: MiniLM ONNX download (~23 MB) + Gemini synthesis must fit.
export const maxDuration = 60;

const MAX_QUESTION_LEN = 1000;
const TOP_K = 10;

// Multi-turn caps — the server never trusts the client's history size.
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 1200;
const MAX_HISTORY_CHARS = 6000;

/** Coerce untrusted history into ≤6 truncated turns under a total char cap. */
function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: HistoryTurn[] = [];
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role;
    const content = String((item as { content?: unknown })?.content ?? "").trim();
    if ((role === "user" || role === "assistant") && content) {
      turns.push({ role, content: content.slice(0, MAX_TURN_CHARS) });
    }
  }
  let kept = turns.slice(-MAX_HISTORY_TURNS);
  while (kept.length > 0 && kept.reduce((s, t) => s + t.content.length, 0) > MAX_HISTORY_CHARS) {
    kept = kept.slice(1); // drop oldest first
  }
  return kept;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const {
    subject: rawSubject,
    question: rawQuestion,
    history: rawHistory,
    // Quick-action buttons carry their own intent (and topic, for a topic
    // chip) so the request costs zero LLM calls — see classificationFromClient.
    intent: rawIntent,
    topic: rawTopic,
  } = (body ?? {}) as Record<string, unknown>;
  const subject = String(rawSubject ?? "").trim();
  // "imp ques" → "important questions" etc. before anything reads the query.
  const question = normalizeQuery(String(rawQuestion ?? ""));
  const history = sanitizeHistory(rawHistory);
  const clientCls = classificationFromClient(rawIntent, rawTopic, question);
  if (!subject || !question) {
    return NextResponse.json({ error: "subject and question are required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LEN) {
    return NextResponse.json(
      { error: `question exceeds ${MAX_QUESTION_LEN} characters` },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  const client = rateKey(ipFromHeaders(req.headers));

  // One line per query; `client` is a salted hash, never an IP.
  const logAsk = (fields: Record<string, unknown>) =>
    logEvent({
      evt: "ask",
      subject,
      client,
      question: question.slice(0, 300),
      turns: history.length,
      latency_ms: Date.now() - t0,
      ...fields,
    });

  if (!consume(`total:${client}`, totalLimit())) {
    logAsk({ status: 429, limited: "total" });
    return NextResponse.json(
      { error: "That's a lot of questions this hour — take a short break and try again." },
      { status: 429 },
    );
  }

  // A button-originated request is fully determined by subject + question +
  // filters + the named intent, so it stays cacheable even mid-conversation:
  // history only matters to paths that resolve references against it.
  const cacheable = history.length === 0 || clientCls != null;

  // Cache before any other work — this check happens BEFORE any provider
  // call, on both layers. Filters and the client-named intent are part of the
  // key, and both come from deterministic extractors, so the key is known
  // without classifying anything.
  const key = cacheKey(subject, question, {
    year: extractYear(question),
    examType: extractExamType(question),
    intent: clientCls?.intent ?? null,
  });
  if (cacheable) {
    const hit = await cacheGet(key);
    if (hit) {
      logAsk({ status: 200, intent: hit.body.intent, cache_hit: true, cache_layer: hit.layer });
      return NextResponse.json({ ...hit.body, cached: true });
    }
  }

  // Final invariant gate (see CLAUDE.md): violations are logged loudly —
  // deterministic-path hits are bugs to fix at the source.
  let statsForInvariants: import("@/lib/rag/subject-stats").SubjectStats | null = null;
  let filtersActiveForInvariants = false;
  // Which lane provider wrote the prose, when any did — logged so a quality
  // regression can be traced to the provider that produced it.
  let synthProvider: string | null = null;

  // Successful history-free responses land in the cache on the way out.
  const respond = async (body: Record<string, unknown>, canCache = true) => {
    const violations = checkResponseInvariants(body, {
      stats: statsForInvariants,
      filtersActive: filtersActiveForInvariants,
    });
    if (violations.length > 0) {
      logEvent({ evt: "invariant_violation", subject, intent: body.intent, violations });
    }
    // Awaited, not fire-and-forget: a serverless instance can be frozen the
    // moment the response is returned, and a dropped write means the next
    // student pays for this answer all over again.
    if (cacheable && canCache) await cacheSet(key, body);
    logAsk({
      status: 200,
      intent: body.intent,
      in_scope: body.intent !== "REFUSED",
      cache_hit: false,
      no_answer: body.no_answer === true,
      degraded: body.degraded === true,
      ...(synthProvider ? { provider: synthProvider } : {}),
      ...(clientCls ? { explicit_intent: clientCls.intent } : {}),
    });
    return NextResponse.json(body);
  };

  try {
    if (!(await subjectExists(subject))) {
      return NextResponse.json({ error: `unknown subject: ${subject}` }, { status: 404 });
    }

    // Corpus-health stats drive adaptive honesty (null until audited).
    const subjectStats = await getSubjectStats(subject);
    statsForInvariants = subjectStats;

    // A bare "hi"/"?" is someone knocking, not abuse — nudge, don't refuse.
    if (isGreeting(question)) {
      return respond({ intent: "GREETING", answer: greetingMessage(subject) });
    }

    // Scope gate layer 0: obvious abuse dies here for free, before Gemini.
    if (prefilterAbuse(question)) {
      return respond({ intent: "REFUSED", answer: refusalMessage(subject) });
    }

    // A bare reference ("explain this", "what about that?") with no history
    // has nothing to resolve against — ask, never substitute a guess.
    if (history.length === 0 && UNRESOLVED_REF.test(question)) {
      return respond(
        {
          intent: "SEMANTIC",
          clarification: true,
          answer:
            "**What are you referring to?** I can't see an earlier answer to connect this to — name the topic or paste the question, and I'll take it from there.",
          citations: [],
        },
        false,
      );
    }

    // Scope gate layer 1 rides along in the intent-classification call; the
    // history lets it resolve follow-ups like "explain the second one". A
    // client-named intent skips the call altogether — the greeting and abuse
    // gates above already ran, and every allowed intent is SQL-only.
    let rawCls = clientCls ?? (await classifyIntent(question, { subject, history }));
    if (!rawCls.inScope) {
      // Honest-zero contract: an archive-referential ask about an unknown
      // term ("what gets asked about flurbification") answers with "0 of N
      // exams" + suggestions, not a refusal. The abuse prefilter already ran.
      const shape = extractTopicShape(question);
      if (shape) {
        logEvent({ evt: "scope_override_topic_shaped", subject, topic: shape });
        rawCls = { ...rawCls, inScope: true, intent: "TOPIC_ANALYTICS", topic: shape };
      } else {
        return respond({ intent: "REFUSED", answer: refusalMessage(subject) });
      }
    }
    // Deterministic fixes for known classifier drift (skip -> study guide,
    // filter-only -> analytics, count-phrased topic -> topic analytics).
    // Skipped for a client-named intent: the button is authoritative, and a
    // coercion could otherwise divert it onto a synthesis path and spend the
    // LLM call the explicit intent exists to avoid.
    const { intent, topic, rewritten, topN, solving, predictive, year, examType } =
      clientCls ?? coerceClassification(rawCls, question);
    const filters = { year, examType };
    const note = filterLabel(filters);
    filtersActiveForInvariants = note != null;

    /**
     * Concept search needs a query vector in the corpus's own embedding space,
     * and there is no honest substitute — a different model would be scoring
     * against vectors it never produced. So when the embedder is unavailable,
     * serve the frequency data instead (pure SQL, unaffected), say plainly
     * what is missing, and never cache the outage shape.
     */
    const embeddingsDownResponse = async (): Promise<Record<string, unknown>> => {
      logEvent({ evt: "embeddings_unavailable", subject, intent });
      const lead =
        "**Open-ended search is temporarily unavailable.** I can't match your wording against the papers right now — here's what they ask most often instead. The frequency data below is unaffected.\n\n";
      const [topics, total, tStats] = await Promise.all([
        topicWeightage(subject, 10, filters),
        totalExams(subject, filters),
        topicStats(subject, filters),
      ]);
      const small = isSmallCorpus(subjectStats, total);
      const smallNote = small
        ? `\n\n*Small archive: only ${total} exam${total === 1 ? "" : "s"} on file — treat these counts as indicative.*`
        : "";
      if (topics.length > 0) {
        const questions = await topicQuestions(subject, topics.map((t) => t.topic), 4, filters);
        return {
          intent: "TOPIC_WEIGHTAGE",
          subject,
          answer:
            lead +
            formatTopicWeightageAnswer(subject, topics, total, tStats.topic_count, note) +
            smallNote,
          topics: topics.map((t) => ({ ...t, questions: questions.get(t.topic) ?? [] })),
          total_exams: total,
          topic_count: tStats.topic_count,
          total_appearances: tStats.total_appearances,
          degraded: true,
          ...(small ? { small_corpus: true } : {}),
          ...(note ? { filters: { year, exam_type: examType } } : {}),
        };
      }
      const clusters = await topClusters(subject, TOP_K, filters);
      const sources = await clusterSources(clusters.map((c) => c.cluster_id), 3, filters);
      const annotated = clusters.map(annotateCluster);
      return {
        intent: "ANALYTICS",
        answer:
          lead +
          (annotated.length > 0 ? formatAnalyticsAnswer(subject, annotated, sources, note) : "") +
          smallNote,
        clusters: annotated.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
        total_exams: total,
        degraded: true,
        ...(small ? { small_corpus: true } : {}),
        ...(note ? { filters: { year, exam_type: examType } } : {}),
      };
    };

    // "Predict the paper" phrasings: lead with the disclaimer, then honest
    // frequency data — never Gemini-written fortune telling.
    if (predictive) {
      const [topics, total, pStats] = await Promise.all([
        topicWeightage(subject, 10, filters),
        totalExams(subject, filters),
        topicStats(subject, filters),
      ]);
      if (topics.length > 0) {
        const questions = await topicQuestions(subject, topics.map((t) => t.topic), 4, filters);
        return respond({
          intent: "TOPIC_WEIGHTAGE",
          subject,
          predictive: true,
          answer:
            PREDICTION_DISCLAIMER +
            formatTopicWeightageAnswer(subject, topics, total, pStats.topic_count, note),
          topics: topics.map((t) => ({ ...t, questions: questions.get(t.topic) ?? [] })),
          total_exams: total,
          topic_count: pStats.topic_count,
          ...(note ? { filters: { year, exam_type: examType } } : {}),
        });
      }
      const clusters = await topClusters(subject, TOP_K);
      const sources = await clusterSources(clusters.map((c) => c.cluster_id));
      return respond({
        intent: "ANALYTICS",
        predictive: true,
        answer:
          PREDICTION_DISCLAIMER +
          (clusters.length > 0 ? formatAnalyticsAnswer(subject, clusters, sources) : ""),
        clusters: clusters.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
      });
    }

    if (intent === "ANALYTICS") {
      const clusters = await topClusters(subject, TOP_K, filters);
      if (clusters.length === 0) {
        if (note) {
          // The filter excluded everything — say so, offer the closest year
          // on file, and never silently substitute another year.
          const years = await availableYears(subject);
          const near = year ? nearestYear(years, year) : null;
          return respond({
            intent,
            answer: `The archive has no **${subject}** ${note} papers, so there's nothing to count.${near ? ` Nearest year on file: ${near}.` : ""}${years.length > 0 ? ` Years available for this subject: ${years.join(", ")}.` : ""}`,
            clusters: [],
            filters: { year, exam_type: examType },
          });
        }
        return respond({
          intent,
          answer: `No clustered questions for **${subject}** yet — the pipeline may still be processing this subject.`,
          clusters: [],
        });
      }
      const [sources, analyticsTotal] = await Promise.all([
        clusterSources(clusters.map((c) => c.cluster_id), 3, filters),
        totalExams(subject, filters), // denominator for the coverage bars
      ]);
      const annotated = clusters.map(annotateCluster);
      const small = isSmallCorpus(subjectStats, analyticsTotal);
      let answer = formatAnalyticsAnswer(subject, annotated, sources, note);
      if (small) {
        answer += `\n\n*Small archive: only ${analyticsTotal} exam${analyticsTotal === 1 ? "" : "s"} on file — treat these counts as indicative.*`;
      }
      if ((subjectStats?.pct_figure ?? 0) >= FIGURE_HEAVY_SHARE) {
        answer += `\n\n*Note: many ${subject} questions reference figures or diagrams. Counts group question text — the figures may differ between papers.*`;
      }
      return respond({
        intent,
        answer,
        clusters: annotated.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
        total_exams: analyticsTotal,
        ...(small ? { small_corpus: true } : {}),
        ...(note ? { filters: { year, exam_type: examType } } : {}),
      });
    }

    if (intent === "YEAR_TREND") {
      const trend = await yearTrend(subject);
      if (!trend) {
        // Subject not labeled yet — same graceful analytics fallback as
        // the other topic-level intents.
        const clusters = await topClusters(subject, TOP_K);
        const sources = await clusterSources(clusters.map((c) => c.cluster_id));
        return respond({
          intent: "ANALYTICS",
          answer:
            `Topics aren't labeled for **${subject}** yet, so year-wise trends aren't available — here are the most repeated questions instead.\n\n` +
            (clusters.length > 0 ? formatAnalyticsAnswer(subject, clusters, sources) : ""),
          clusters: clusters.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
        });
      }
      // A year/exam-type filter can't meaningfully narrow a cross-year
      // trend — keep all years, but say so and echo the filter honestly.
      return respond({
        intent,
        answer:
          formatYearTrendAnswer(subject, trend) +
          (note
            ? `\n\n*Note: the ${note} filter doesn't apply to a year-wise trend — showing all years.*`
            : ""),
        trend: { years: trend.years, topics: trend.topics },
        ...(note ? { filters: { year, exam_type: examType } } : {}),
      });
    }

    if (intent === "TOPIC_WEIGHTAGE" || intent === "STUDY_GUIDE") {
      const limit = topN ?? (intent === "STUDY_GUIDE" ? 8 : 10);
      // Filters propagate here exactly like the analytics paths: "which
      // topics to focus in MSE" ranks by MSE-only counts over an MSE-only
      // denominator.
      const [topics, total, stats] = await Promise.all([
        topicWeightage(subject, limit, filters),
        totalExams(subject, filters),
        topicStats(subject, filters),
      ]);

      if (topics.length === 0) {
        // With a filter active and zero matching exams, the filter excluded
        // everything — say so honestly instead of "not labeled".
        if (note && total === 0) {
          const years = await availableYears(subject);
          const near = year ? nearestYear(years, year) : null;
          return respond({
            intent,
            subject,
            answer: `The archive has no **${subject}** ${note} papers, so there's no ${note} weightage to rank.${near ? ` Nearest year on file: ${near}.` : ""}${years.length > 0 ? ` Years available: ${years.join(", ")}.` : ""}`,
            topics: [],
            total_exams: 0,
            filters: { year, exam_type: examType },
          });
        }
        // Subject not labeled yet: fall back to the analytics ranking rather
        // than a dead end (the cron labels new subjects over time).
        const clusters = await topClusters(subject, TOP_K, filters);
        const sources = await clusterSources(clusters.map((c) => c.cluster_id));
        return respond({
          intent: "ANALYTICS",
          answer:
            `Topics aren't labeled for **${subject}** yet — here are the most repeated questions instead.\n\n` +
            (clusters.length > 0 ? formatAnalyticsAnswer(subject, clusters, sources, note) : ""),
          clusters: clusters.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
          ...(note ? { filters: { year, exam_type: examType } } : {}),
        });
      }

      const questions = await topicQuestions(subject, topics.map((t) => t.topic), 4, filters);
      const topicsPayload = topics.map((t) => ({ ...t, questions: questions.get(t.topic) ?? [] }));

      const smallW = isSmallCorpus(subjectStats, total);
      const smallNote = `\n\n*Small archive: only ${total} ${note ? `${note} ` : ""}exam${total === 1 ? "" : "s"} on file — treat rankings as indicative.*`;
      if (intent === "TOPIC_WEIGHTAGE") {
        return respond({
          intent,
          subject,
          answer: formatTopicWeightageAnswer(subject, topics, total, stats.topic_count, note) + (smallW ? smallNote : ""),
          topics: topicsPayload,
          total_exams: total,
          topic_count: stats.topic_count,
          total_appearances: stats.total_appearances,
          ...(smallW ? { small_corpus: true } : {}),
          ...(note ? { filters: { year, exam_type: examType } } : {}),
        });
      }

      // STUDY_GUIDE: Gemini writes the plan from the deterministic data.
      // The rarely-asked tail comes from the FULL distribution and is only
      // provided when the student actually asks about skipping. It stays
      // UNFILTERED on purpose: a topic that is rare in MSE but heavy in ESE
      // must never surface as a skip candidate.
      const tail = isSkipQuery(question) ? await topicTail(subject, 10) : null;
      if (!consume(`synth:${client}`, synthLimit())) {
        logAsk({ status: 429, limited: "synth" });
        return NextResponse.json(
          {
            error:
              "You've used this hour's AI answers. Frequency analytics still work — or try again in a bit.",
          },
          { status: 429 },
        );
      }
      let plan: SynthResult;
      try {
        plan = await synthesizeWithQuality(
          (fix) => synthesizeStudyGuide(subject, question, topics, total, topN, history, tail, fix),
          PROSE_WORDS_STRATEGY,
          { subject, question },
        );
      } catch (err) {
        if (err instanceof GeminiUnavailable) {
          return respond(
            {
              intent: "TOPIC_WEIGHTAGE",
              answer:
                "AI study plans are resting until tomorrow — here's the topic weightage to plan from instead.\n\n" +
                formatTopicWeightageAnswer(subject, topics, total, stats.topic_count, note),
              topics: topicsPayload,
              total_exams: total,
              topic_count: stats.topic_count,
              degraded: true,
              ...(note ? { filters: { year, exam_type: examType } } : {}),
            },
            false,
          );
        }
        throw err;
      }
      synthProvider = plan.provider;
      const guardedPlan = guardOutput(plan.text, subject, question);
      if (guardedPlan.flagged) {
        return respond({ intent: "REFUSED", answer: guardedPlan.answer });
      }
      let planAnswer = stripRedundantTables(stripInternalNames(guardedPlan.answer));

      // Skip-contract guard, independent of the prompt: retry once with the
      // concrete violation, then fall back to a deterministic safe answer —
      // a >3-exam topic must never reach the student as a skip candidate.
      if (tail !== null) {
        const protectedTopics = topics.filter((t) => t.exam_count > 3).map((t) => t.topic);
        let violation = skipContractViolation(planAnswer, protectedTopics);
        if (violation) {
          try {
            const redo = await synthesizeStudyGuide(
              subject,
              question,
              topics,
              total,
              topN,
              history,
              tail,
              `Your previous draft violated the skip contract: ${violation}. Rewrite it obeying every rule.`,
            );
            planAnswer = stripRedundantTables(
              stripInternalNames(guardOutput(redo.text, subject, question).answer),
            );
            violation = skipContractViolation(planAnswer, protectedTopics);
          } catch {
            // fall through to the deterministic answer
          }
          if (violation) {
            logEvent({ evt: "skip_contract_fallback", subject, violation });
            planAnswer = formatSkipFallback(subject, tail, topics, total);
          }
        }
      }
      if (smallW) {
        planAnswer = `*Small archive: only ${total} exam${total === 1 ? "" : "s"} on file — indicative, not definitive.*\n\n${planAnswer}`;
      }
      return respond({
        intent,
        subject,
        answer: planAnswer,
        topics: topicsPayload,
        total_exams: total,
        topic_count: stats.topic_count,
        total_appearances: stats.total_appearances,
        ...(smallW ? { small_corpus: true } : {}),
        ...(note ? { filters: { year, exam_type: examType } } : {}),
        ...(tail !== null
          ? { skip_candidates: tail.map((t) => ({ topic: t.topic, exam_count: t.exam_count })) }
          : {}),
      });
    }

    if (intent === "TOPIC_ANALYTICS") {
      // Label-first: when the phrase matches a canonical topic label, answer
      // from exactly that label's clusters so the count agrees with the
      // weightage table. Embedding search stays the fallback for phrases
      // that don't map to a label (or map ambiguously).
      const rawPhrase = topic ?? question;
      const label = await matchTopicLabel(subject, rawPhrase);
      const topicPhrase = label ?? rawPhrase;
      const exhaustive = isExhaustiveQuery(question);
      // Always fetch the full set (bounded): the total is needed for the
      // "top 10 of N" statement and the exam count either way.
      let allClusters:
        | Awaited<ReturnType<typeof labelClusters>>
        | Awaited<ReturnType<typeof topicClusters>>;
      try {
        allClusters = label
          ? await labelClusters(subject, label, MAX_TOPIC_CLUSTERS, filters)
          : await topicClusters(subject, await embedQuery(rawPhrase), MAX_TOPIC_CLUSTERS, filters);
      } catch (err) {
        if (!(err instanceof EmbeddingsUnavailable)) throw err;
        return respond(await embeddingsDownResponse(), false);
      }
      const clusters = exhaustive ? allClusters : allClusters.slice(0, TOP_K);
      if (clusters.length === 0) {
        // The total leads UNCONDITIONALLY — a zero-match topic query still
        // opens with "appeared in 0 of M exams".
        const total = await totalExams(subject, filters);
        const zeroLead = `**${topicPhrase}** appeared in **0** of ${total} ${subject} exams${note ? ` (${note} only)` : ""}.`;
        if (note) {
          const years = await availableYears(subject);
          const near = year ? nearestYear(years, year) : null;
          return respond({
            intent,
            topic: topicPhrase,
            topic_exam_count: 0,
            total_exams: total,
            answer: `${zeroLead} The archive may simply not have those papers.${near ? ` Nearest year on file: ${near}.` : ""}${years.length > 0 ? ` Years available: ${years.join(", ")}.` : ""}`,
            clusters: [],
            filters: { year, exam_type: examType },
          });
        }
        return respond({
          intent,
          topic: topicPhrase,
          topic_exam_count: 0,
          total_exams: total,
          answer: `${zeroLead} Either it isn't asked in this subject's papers, or the phrasing differs — try an open-ended question instead.`,
          clusters: [],
        });
      }
      const ids = clusters.map((c) => c.cluster_id);
      const allIds = allClusters.map((c) => c.cluster_id);
      const [sources, topicExamCount, total] = await Promise.all([
        clusterSources(ids, 3, filters),
        // Exam totals always aggregate over the FULL matched set, never
        // just the rows shown.
        label ? labelExamCount(subject, label, filters) : examCountForClusters(allIds, filters),
        totalExams(subject, filters), // denominator matches the active filter
      ]);
      const annotated = clusters.map(annotateCluster);
      const small = isSmallCorpus(subjectStats, total);
      let answer = formatTopicAnalyticsAnswer(subject, topicPhrase, annotated, sources, {
        topicExamCount,
        totalExams: total,
        clusterTotal: allClusters.length,
        exhaustive,
        filterNote: note,
      });
      if (small) {
        answer += `\n\n*Small archive: only ${total} exam${total === 1 ? "" : "s"} on file — treat these counts as indicative.*`;
      }
      return respond({
        intent,
        topic: topicPhrase,
        answer,
        topic_exam_count: topicExamCount,
        total_exams: total,
        cluster_total: allClusters.length,
        ...(exhaustive ? { exhaustive: true } : {}),
        clusters: annotated.map((c) => {
          const src = sources.get(c.cluster_id);
          return { ...c, sources: src?.list ?? [], source_total: src?.total ?? 0 };
        }),
        ...(small ? { small_corpus: true } : {}),
        ...(note ? { filters: { year, exam_type: examType } } : {}),
      });
    }

    // SEMANTIC: embed the query, then pgvector search *already* scoped to the
    // subject in SQL — the LLM only ever sees same-subject questions. The
    // classifier's standalone rewrite makes follow-ups searchable.
    let searchQuery = rewritten ?? question;
    // "solve question 2": resolve the numbered reference against the last
    // numbered list in the history — and when there's nothing to resolve
    // against, ask rather than guess. The original question is checked too:
    // with no history, any "resolution" the rewrite produced is fabrication
    // (live Gemini paraphrases "question 2" into "the second question").
    const numRef = NUMBERED_REF.exec(searchQuery) ?? NUMBERED_REF.exec(question);
    if (numRef) {
      const resolved = history.length > 0 ? resolveNumberedRef(history, Number(numRef[1])) : null;
      if (resolved) {
        searchQuery = resolved;
      } else if (history.length === 0 || NUMBERED_REF.test(searchQuery)) {
        // No context at all, or context that didn't resolve it — ask.
        return respond(
          {
            intent: "SEMANTIC",
            clarification: true,
            answer: `**Which question do you mean?** I can't see a list to match "question ${numRef[1]}" against — paste the question text${solving ? " and I'll work through it" : ""}, or ask again right after the answer that listed it.`,
            citations: [],
          },
          false,
        );
      }
      // else: history exists and the classifier's rewrite already resolved
      // the reference into real content — proceed with it.
    }
    let queryVec: number[];
    try {
      queryVec = await embedQuery(searchQuery);
    } catch (err) {
      if (!(err instanceof EmbeddingsUnavailable)) throw err;
      return respond(await embeddingsDownResponse(), false);
    }
    const hits = await semanticSearch(subject, queryVec, TOP_K);

    // Grounding floor: without enough genuinely similar questions, honesty
    // beats synthesis — say so and suggest what the papers DO cover.
    const grounded = hits.filter((h) => h.similarity >= SEMANTIC_MIN_SIMILARITY);
    if (grounded.length < MIN_GROUNDING_HITS) {
      // Safety net: a query built from core study vocabulary must never dead-
      // end in no-answer — worst case it gets the weightage ranking.
      if (/\b(important|topics?|questions?|study|repeated|weightage)\b/i.test(question)) {
        const [wTopics, wTotal, wStats] = await Promise.all([
          topicWeightage(subject, 10, filters),
          totalExams(subject, filters),
          topicStats(subject, filters),
        ]);
        if (wTopics.length > 0) {
          const questions = await topicQuestions(subject, wTopics.map((t) => t.topic), 4, filters);
          return respond({
            intent: "TOPIC_WEIGHTAGE",
            subject,
            answer: formatTopicWeightageAnswer(subject, wTopics, wTotal, wStats.topic_count, note),
            topics: wTopics.map((t) => ({ ...t, questions: questions.get(t.topic) ?? [] })),
            total_exams: wTotal,
            topic_count: wStats.topic_count,
            total_appearances: wStats.total_appearances,
            ...(note ? { filters: { year, exam_type: examType } } : {}),
          });
        }
      }
      // Suggest topic names — students think in concepts, not verbatim
      // question texts. Cluster texts remain the unlabeled-subject fallback.
      const topicRows = await topicWeightage(subject, 3);
      const suggestions =
        topicRows.length > 0
          ? topicRows.map((t) => `- ${t.topic} (${t.exam_count} exams)`)
          : (await topClusters(subject, 3)).map(
              (c) =>
                `- ${c.representative_text.length > 120 ? `${c.representative_text.slice(0, 120)}…` : c.representative_text}`,
            );
      return respond({
        intent,
        answer:
          `The previous-year papers for **${subject}** don't cover this specifically.` +
          (suggestions.length > 0
            ? `\n\nTopics the papers do ask about:\n${suggestions.join("\n")}`
            : ""),
        citations: [],
        no_answer: true,
      });
    }

    const citations = grounded.map((h, i) => ({
      ref: i + 1,
      question_text: h.question_text,
      marks: h.marks,
      sub_label: h.sub_label,
      file_name: h.file_name,
      year: h.year,
      exam_type: h.exam_type,
      url: h.url,
      standard_subject: h.standard_subject,
      topic: h.topic,
      similarity: h.similarity,
    }));

    // Synthesis is the only expensive Gemini call — it gets the strict cap.
    if (!consume(`synth:${client}`, synthLimit())) {
      logAsk({ status: 429, limited: "synth" });
      return NextResponse.json(
        {
          error:
            "You've used this hour's AI answers. Frequency analytics still work — or try again in a bit.",
        },
        { status: 429 },
      );
    }

    let raw: SynthResult;
    try {
      raw = await synthesizeWithQuality(
        (fix) => synthesizeAnswer(subject, question, grounded, history, fix),
        PROSE_WORDS_EXPLAIN,
        { subject, question },
      );
    } catch (err) {
      if (err instanceof GeminiUnavailable) {
        // Quota exhausted: never go dark — hand over raw retrieval instead.
        return respond(
          {
            intent,
            answer:
              "AI answers are resting until tomorrow — here are the most relevant past questions instead.",
            citations,
            degraded: true,
          },
          false, // don't cache the degraded shape past the outage
        );
      }
      throw err;
    }
    synthProvider = raw.provider;
    const guarded = guardOutput(raw.text, subject, question);
    if (guarded.flagged) {
      return respond({ intent: "REFUSED", answer: guarded.answer });
    }
    // Contract enforcement: resolve-first (no contradictory non-coverage
    // preamble), then citation-shape normalization — before any client
    // ever sees the text. Worked solutions get the verification caution.
    let answer = stripContradictoryPreamble(guarded.answer);
    answer = stripRedundantTables(stripInternalNames(answer));
    answer = normalizeCitations(answer, citations.length);
    if (solving) answer += SOLUTION_CAUTION;
    return respond({ intent, answer, citations });
  } catch (err) {
    if (err instanceof GeminiUnavailable) {
      logAsk({ status: 503 });
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("POST /api/ask failed:", err);
    logAsk({ status: 500 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
