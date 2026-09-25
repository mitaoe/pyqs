#!/usr/bin/env node
/**
 * Low-memory cross-subject battery runner (~50MB vs vitest's ~1GB) for
 * memory-constrained machines. Same structural invariants as
 * tests/battery/subjects.battery.test.ts; retries once through transient
 * network failures (server watchdog restart windows) and once through
 * degraded responses (Gemini RPM).
 *
 *   node scripts/battery-runner.mjs <subjects-file> <results-json>
 */
import fs from "node:fs";

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const [, , subjectsFile, resultsFile, modeArg] = process.argv;
// "full" = 9-query canonical battery; "smoke" = 3 cheap deterministic
// queries asserting only the hard invariants (counts, denominators,
// non-empty) — suitable for an all-subjects sweep.
const MODE = modeArg === "smoke" ? "smoke" : "full";
const SUBJECTS = fs.readFileSync(subjectsFile, "utf8").split(",").map((s) => s.trim()).filter(Boolean);

const INTERNAL = /topic_weightage_data|rarely_asked_topics|retrieved_questions|student_question|<\/?(?:topic_weightage_data|rarely_asked_topics|retrieved_questions|student_question|conversation)>/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(subject, question) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, question }),
      });
      const body = await res.json();
      if (res.status === 200 && body.degraded && attempt === 0) {
        await sleep(20_000); // RPM window
        continue;
      }
      return { status: res.status, ms: Date.now() - t0, body };
    } catch {
      await sleep(20_000); // server restart window
    }
  }
  return { status: 0, ms: 0, body: {}, netfail: true };
}

// assertion helpers -> throw with a symptom string
const fail = (msg) => {
  throw new Error(msg);
};
function base(r) {
  if (r.netfail) fail("network failure after retries");
  if (r.status !== 200) fail(`HTTP ${r.status}`);
  if (r.ms > 60_000) fail(`slow: ${r.ms}ms`);
  if (!String(r.body.answer ?? "")) fail("empty answer");
  if (INTERNAL.test(r.body.answer)) fail("internal names leaked");
}
function countsWithin(r) {
  const total = r.body.total_exams;
  if (total == null) return;
  for (const c of r.body.clusters ?? []) if (c.exam_count > total) fail(`cluster count ${c.exam_count} > total ${total}`);
  for (const t of r.body.topics ?? []) if (t.exam_count > total) fail(`topic count ${t.exam_count} > total ${total}`);
  if (r.body.topic_exam_count != null && r.body.topic_exam_count > total) fail("topic_exam_count > total");
}

function checksFor(subject, ctx) {
  if (MODE === "smoke") {
    return [
      ["most repeated questions", async () => {
        const r = await ask(subject, "What are the most repeated questions?");
        base(r);
        countsWithin(r);
        if (!(r.body.clusters ?? []).length) fail("no clusters");
      }],
      ["topic-wise weightage", async () => {
        const r = await ask(subject, "topic-wise weightage");
        base(r);
        countsWithin(r);
        for (const t of r.body.topics ?? []) {
          if (t.cluster_count != null && (t.questions?.length ?? 0) > t.cluster_count) {
            fail("preview longer than cluster_count");
          }
        }
      }],
      ["topic count query", async () => {
        if (!ctx.topTopic) return;
        const r = await ask(subject, `how many times has ${ctx.topTopic} been asked`);
        base(r);
        countsWithin(r);
      }],
    ];
  }
  return [
    ["most repeated questions", async () => {
      const r = await ask(subject, "What are the most repeated questions?");
      base(r);
      if (r.body.intent !== "ANALYTICS") fail(`intent ${r.body.intent}`);
      if (!(r.body.clusters ?? []).length) fail("no clusters");
      countsWithin(r);
      if (ctx.small && !/small archive/i.test(r.body.answer)) fail("missing small-archive caveat");
    }],
    ["topic-wise weightage", async () => {
      const r = await ask(subject, "topic-wise weightage");
      base(r);
      if (r.body.intent !== "TOPIC_WEIGHTAGE") fail(`intent ${r.body.intent}`);
      if (!(r.body.topics ?? []).length) fail("no topics");
      countsWithin(r);
      if (!/^\*\*/.test(r.body.answer.trim())) fail("no verdict lead");
    }],
    ["year-wise trends", async () => {
      const r = await ask(subject, "Show me the year-wise trends");
      base(r);
      if (r.body.intent !== "YEAR_TREND") return; // unlabeled fallback tolerated
      const years = r.body.trend?.years ?? [];
      for (const y of years) if (!/^20\d{2}$/.test(y)) fail(`bad year ${y}`);
      if (years.length < 3) {
        for (const t of r.body.trend?.topics ?? []) if (t.status) fail("status set with <3 years");
        if (!/too few/i.test(r.body.answer)) fail("missing too-few-years note");
      }
      if (!/archive coverage|too few/i.test(r.body.answer)) fail("missing coverage statement");
    }],
    ["what should I study first", async () => {
      const r = await ask(subject, "what should I study first");
      base(r);
      if (r.body.degraded) return;
      if (r.body.intent !== "STUDY_GUIDE") fail(`intent ${r.body.intent}`);
      if (!(ctx.small ? /^\*/ : /^\*\*/).test(r.body.answer.trim())) fail("bad lead shape");
      if (ctx.small && !/small archive/i.test(r.body.answer)) fail("missing small caveat");
    }],
    ["skip paraphrase", async () => {
      const r = await ask(subject, "which topics can I skip if I'm short on time?");
      base(r);
      if (r.body.degraded) return;
      if (r.body.intent !== "STUDY_GUIDE") fail(`intent ${r.body.intent}`);
      if (!/not skippable/i.test(r.body.answer)) fail("missing 'not skippable'");
      for (const t of r.body.skip_candidates ?? []) if (t.exam_count > 3) fail(`skip candidate ${t.topic} has ${t.exam_count} exams`);
    }],
    ["topic count query", async () => {
      if (!ctx.topTopic) return;
      const r = await ask(subject, `how many times has ${ctx.topTopic} been asked`);
      base(r);
      if (r.body.intent !== "TOPIC_ANALYTICS") fail(`intent ${r.body.intent}`);
      if (!/appeared in \*\*\d+\*\* of \d+/.test(r.body.answer)) fail("missing N-of-M lead");
      countsWithin(r);
    }],
    ["semantic explain", async () => {
      if (!ctx.topTopic) return;
      const r = await ask(subject, `explain ${ctx.topTopic} in simple words`);
      base(r);
      if (!["SEMANTIC", "TOPIC_ANALYTICS", "TOPIC_WEIGHTAGE"].includes(r.body.intent)) fail(`intent ${r.body.intent}`);
      if (r.body.intent === "SEMANTIC" && !r.body.no_answer && !r.body.degraded && !(r.body.citations ?? []).length) fail("semantic without citations");
    }],
    ["typo'd important questions", async () => {
      const r = await ask(subject, "important questiions to study");
      base(r);
      if (r.body.no_answer) fail("dead-ended in no-answer");
      if (!["ANALYTICS", "TOPIC_WEIGHTAGE", "STUDY_GUIDE"].includes(r.body.intent)) fail(`intent ${r.body.intent}`);
    }],
    ["should-I-prioritize", async () => {
      if (!ctx.topTopic) return;
      const r = await ask(subject, `should I prioritize ${ctx.topTopic}?`);
      base(r);
      if (r.body.degraded) return;
      if (r.body.intent !== "STUDY_GUIDE") fail(`intent ${r.body.intent}`);
      if (!(ctx.small ? /^\*/ : /^\*\*\s*(Yes|No)/i).test(r.body.answer.trim())) fail("missing Yes/No verdict");
    }],
  ];
}

const failures = [];
let passed = 0;
let degradedSeen = 0;

for (let si = 0; si < SUBJECTS.length; si++) {
  const subject = SUBJECTS[si];
  const pre = await ask(subject, "topic-wise weightage");
  const ctx = {
    topTopic: pre.body?.topics?.[0]?.topic ?? null,
    small: pre.body?.small_corpus === true,
  };
  let subjFails = 0;
  for (const [query, run] of checksFor(subject, ctx)) {
    try {
      await run();
      passed++;
    } catch (e) {
      subjFails++;
      failures.push({ subject, query, symptom: e.message });
    }
  }
  if (pre.body?.degraded) degradedSeen++;
  const per = MODE === "smoke" ? 3 : 9;
  console.log(`[${si + 1}/${SUBJECTS.length}] ${subject}: ${per - subjFails}/${per}${subjFails ? ` (${subjFails} FAIL)` : ""}`);
}

const summary = { subjects: SUBJECTS.length, passed, failed: failures.length, degraded_pretests: degradedSeen, failures };
fs.writeFileSync(resultsFile, JSON.stringify(summary, null, 2));
console.log(`DONE: ${passed} passed, ${failures.length} failed across ${SUBJECTS.length} subjects`);
