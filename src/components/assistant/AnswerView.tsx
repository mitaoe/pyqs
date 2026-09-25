"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "@phosphor-icons/react";

import {
  type AskResponse,
  type Citation,
  type ClusterResult,
  type TopicResult,
  type TrendTopicResult,
  yearSpan,
} from "@/lib/rag/api-types";
import { PRIORITY_MUST_RATIO, PRIORITY_SHOULD_RATIO } from "@/lib/rag/config";

/** Some papers carry the literal string "Unknown" for year/exam_type — hide it. */
function known(value: string | null): string | null {
  return value && value.trim().toLowerCase() !== "unknown" ? value : null;
}

/* ---------- shared glanceable primitives ---------- */

const TIER_STYLES = {
  must: { label: "Must know", classes: "bg-brand text-white" },
  should: { label: "Should know", classes: "bg-brand/15 text-brand" },
  ifTime: { label: "If time permits", classes: "bg-accent text-content/60" },
};

/** Topic-level tiers: fraction of the subject's total exams. */
function priorityTier(examCount: number, total: number | null) {
  if (!total || total <= 0) return null;
  const ratio = examCount / total;
  if (ratio >= PRIORITY_MUST_RATIO) return TIER_STYLES.must;
  if (ratio >= PRIORITY_SHOULD_RATIO) return TIER_STYLES.should;
  return TIER_STYLES.ifTime;
}

function CoverageBar({ count, total }: { count: number; total: number | null }) {
  if (!total || total <= 0) return null;
  const pct = Math.max(2, Math.min(100, Math.round((count / total) * 100)));
  return (
    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-accent">
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The count is the boldest element on every row. */
function BigCount({ count, total }: { count: number; total: number | null }) {
  return (
    <span className="shrink-0 whitespace-nowrap tabular-nums">
      <span className="text-lg font-extrabold leading-none text-content">{count}</span>
      {total != null && total > 0 && <span className="text-xs text-content/50">/{total}</span>}
    </span>
  );
}

function MutedPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-content/5 px-2 py-0.5 text-[11px] text-content/50">
      {children}
    </span>
  );
}

function TopicChip({ topic }: { topic?: string | null }) {
  if (!topic) return null;
  return (
    <span className="mr-1.5 inline-block max-w-44 truncate rounded bg-brand/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-brand">
      {topic}
    </span>
  );
}

/** ⓘ tooltip carrying the methodology note once, instead of on every answer. */
function MethodNote() {
  return (
    <details className="relative inline-block align-middle">
      <summary className="inline-flex h-6 w-6 min-h-0 cursor-pointer list-none items-center justify-center rounded-full text-sm text-content/50 hover:text-brand [&::-webkit-details-marker]:hidden">
        ⓘ
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-64 rounded-lg border border-accent bg-secondary p-2.5 text-xs leading-snug text-content/80 shadow-xl">
        Counted over distinct exams — repeated uploads of the same paper count once.
      </div>
    </details>
  );
}

/** Universal 2-line clamp with tap-to-expand (44px minimum tap target). */
function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={`block min-h-11 w-full cursor-pointer text-left ${className}`}
      title={expanded ? "Collapse" : "Show full text"}
    >
      <span className={`whitespace-pre-line ${expanded ? "" : "line-clamp-2"}`}>{text}</span>
    </button>
  );
}

/** "49 exams · 150 topics · top topic in 61% of exams" — the concentration
 *  stat uses exam coverage, never a denominator that dilutes it. */
function StatStrip({
  totalExams,
  topicCount,
  topics,
  smallCorpus = false,
}: {
  totalExams: number | null;
  topicCount?: number;
  topics: TopicResult[];
  smallCorpus?: boolean;
}) {
  if (totalExams == null) return null;
  // Small archives get raw counts only — a percentage of 3 exams is noise.
  const parts: string[] = [`${totalExams} exam${totalExams === 1 ? "" : "s"}${smallCorpus ? " (small archive)" : ""}`];
  if (topicCount) parts.push(`${topicCount} topics`);
  if (!smallCorpus && totalExams > 0 && topics.length > 0) {
    parts.push(`top topic in ${Math.round((topics[0].exam_count / totalExams) * 100)}% of exams`);
  }
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-content/60"
      data-testid="stat-strip"
    >
      <span>{parts.join(" · ")}</span>
      <MethodNote />
    </div>
  );
}

const Prose = ({ children }: { children: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-li:my-0.5">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
);

/* ---------- intent renderers ---------- */

export default function AnswerView({
  res,
  msgId,
  threadActive = false,
}: {
  res: AskResponse;
  msgId: number;
  /** True on the latest cited answer — its Sources rows anchor the threads. */
  threadActive?: boolean;
}) {
  if (res.intent === "GREETING") {
    return (
      <div data-testid="greeting-answer" className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{res.answer}</ReactMarkdown>
      </div>
    );
  }
  if (res.intent === "REFUSED") {
    return (
      <div data-testid="refused-answer">
        <span className="mb-2 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-content/80">
          Out of scope
        </span>
        <Prose>{res.answer}</Prose>
      </div>
    );
  }
  if (res.intent === "SEMANTIC") {
    return (
      <SemanticAnswer
        answer={res.answer}
        citations={res.citations ?? []}
        msgId={msgId}
        threadActive={threadActive}
      />
    );
  }
  if (res.intent === "YEAR_TREND") {
    return <YearTrendAnswer answer={res.answer} trend={res.trend ?? null} />;
  }
  if (res.intent === "TOPIC_WEIGHTAGE" || res.intent === "STUDY_GUIDE") {
    return <TopicAnswer res={res} />;
  }

  /* ANALYTICS + TOPIC_ANALYTICS */
  const filterNote = res.filters
    ? [res.filters.exam_type, res.filters.year].filter(Boolean).join(" ")
    : null;
  return (
    <div data-testid="analytics-answer">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
          {res.intent === "ANALYTICS" ? "Most asked — whole subject" : "Topic frequency"}
        </span>
        {res.topic && (
          <span className="max-w-48 truncate rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-content/80">
            {res.topic}
          </span>
        )}
        {filterNote && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-content/80">
            {filterNote} only
          </span>
        )}
        <MethodNote />
      </div>
      {res.intent === "TOPIC_ANALYTICS" &&
        (res.clusters?.length ?? 0) > 0 &&
        res.topic_exam_count != null &&
        res.total_exams != null && (
          <p className="mb-2 text-sm text-content" data-testid="topic-total-lead">
            <span className="font-semibold">{res.topic}</span> appeared in{" "}
            <span className="text-lg font-extrabold text-content">{res.topic_exam_count}</span> of{" "}
            {res.total_exams} exams
            {filterNote ? ` (${filterNote} only)` : ""}.
          </p>
        )}
      {(res.clusters?.length ?? 0) === 0 ? (
        <Prose>{res.answer}</Prose>
      ) : (
        <>
          <ol className="space-y-3.5">
            {res.clusters!.slice(0, 10).map((c, i) => (
              <ClusterItem
                key={c.cluster_id}
                cluster={c}
                rank={i + 1}
                totalExams={res.total_exams ?? null}
                filterNote={filterNote}
                smallCorpus={res.small_corpus === true}
              />
            ))}
          </ol>
          {res.clusters!.length > 10 && (
            <details className="mt-2">
              <summary className="flex min-h-11 cursor-pointer select-none items-center text-xs font-semibold text-content/60 hover:text-brand">
                Show {res.clusters!.length - 10} more question groups
              </summary>
              <ol className="mt-2 space-y-3.5">
                {res.clusters!.slice(10).map((c, i) => (
                  <ClusterItem
                    key={c.cluster_id}
                    cluster={c}
                    rank={i + 11}
                    totalExams={res.total_exams ?? null}
                    filterNote={filterNote}
                    smallCorpus={res.small_corpus === true}
                  />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Topic question list with the TRUE total in the header (never the preview
 * slice length). On first expand, the full count-ordered list lazy-loads
 * from /api/topic-questions; the first 10 render, the rest fold behind
 * "show more" — presentation folding over complete data.
 */
function TopicQuestionList({
  subject,
  topic,
  preview,
  total,
}: {
  subject: string;
  topic: string;
  preview: { text: string; exam_count: number }[];
  total: number;
}) {
  const [full, setFull] = useState<{ text: string; exam_count: number }[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [showAll, setShowAll] = useState(false);

  const load = () => {
    if (full || state === "loading" || total <= preview.length) return;
    setState("loading");
    fetch(
      `/api/topic-questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b: { questions: { text: string; exam_count: number }[] }) => {
        setFull(b.questions);
        setState("idle");
      })
      .catch(() => setState("failed"));
  };

  const questions = full ?? preview;
  const visible = showAll ? questions : questions.slice(0, 10);
  return (
    <details className="mt-1.5" onToggle={(e) => e.currentTarget.open && load()}>
      <summary
        className="flex min-h-11 cursor-pointer select-none items-center text-xs font-medium text-content/60 hover:text-brand"
        data-testid="topic-questions-summary"
      >
        Questions ({total})
      </summary>
      <ul className="space-y-1">
        {visible.map((q, i) => (
          <li
            key={`${i}-${q.text.slice(0, 40)}`}
            className="rounded-lg bg-content/5 px-2.5 py-1.5 text-xs text-content/80"
          >
            <ExpandableText text={q.text} />
            <span className="mt-0.5 block text-[11px] text-content/50">
              asked in {q.exam_count} exam{q.exam_count === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      {state === "loading" && (
        <p className="mt-1 text-[11px] text-content/50">Loading all {total} questions…</p>
      )}
      {state === "failed" && (
        <p className="mt-1 text-[11px] text-content/50">
          Couldn't load the full list — showing a preview of {questions.length}.
        </p>
      )}
      {!showAll && questions.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-1 flex min-h-11 items-center text-xs font-medium text-brand hover:text-brand"
        >
          Show {questions.length - 10} more
        </button>
      )}
      {state === "idle" && full === null && total > preview.length && (
        <p className="mt-1 text-[11px] text-content/50">Preview of {preview.length} shown.</p>
      )}
    </details>
  );
}

function ClusterItem({
  cluster: c,
  rank,
  totalExams,
  filterNote = null,
  smallCorpus = false,
}: {
  cluster: ClusterResult;
  rank: number;
  totalExams: number | null;
  filterNote?: string | null;
  smallCorpus?: boolean;
}) {
  const span = yearSpan(c.years_spanned);
  const yearsChip = filterNote ? (span ? `asked since ${span.split("–")[0]}` : null) : span;

  return (
    <li className="rounded-xl border border-accent/60 bg-secondary p-3.5 shadow-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <TopicChip topic={c.topic} />
              <ExpandableText text={c.representative_text} className="text-sm leading-snug" />
            </div>
            <BigCount count={c.exam_count} total={totalExams} />
          </div>
          <CoverageBar count={c.exam_count} total={totalExams} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-content/50">
              {c.exam_count} exam{c.exam_count === 1 ? "" : "s"}
              {filterNote ? ` in ${filterNote}` : ""}
            </span>
            {yearsChip && <MutedPill>{yearsChip}</MutedPill>}
            {c.has_figure && <MutedPill>has figure</MutedPill>}
            {c.topic_similarity != null && !smallCorpus && (
              <MutedPill>{Math.round(c.topic_similarity * 100)}% match</MutedPill>
            )}
          </div>
          {c.text_twin && (
            <p className="mt-1 text-[11px] text-content/50">
              Count refers to a figure-based question — the figure may differ between papers.
            </p>
          )}
          {c.sources.length > 0 && (
            <details className="mt-2">
              <summary className="flex min-h-11 cursor-pointer select-none items-center text-xs font-medium text-content/60 hover:text-brand">
                Sources ({c.source_total ?? c.sources.length})
              </summary>
              <ul className="space-y-1">
                {c.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate rounded-lg bg-content/5 px-2.5 py-2.5 text-xs text-brand underline-offset-2 hover:underline"
                      title={s.file_name}
                    >
                      {[known(s.year), known(s.exam_type)].filter(Boolean).join(" · ") || "PDF"} —{" "}
                      {s.file_name}
                      {s.matches_filter === false && (
                        <span className="ml-1 text-content/50">· outside filter</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
              {(c.source_total ?? 0) > c.sources.length && (
                <p className="mt-1 text-[11px] text-content/50">
                  Showing the {c.sources.length} most recent of {c.source_total} papers.
                </p>
              )}
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- topic weightage / study guide ---------- */

/** Split a study plan into Day-N cards when the model wrote one. */
export function splitDayPlan(
  answer: string,
): { intro: string; days: { label: string; body: string }[] } | null {
  const lines = answer.split("\n");
  const dayStarts: number[] = [];
  const dayRe = /^\s*(?:[-*]\s*)?\**\s*Day\s+(\d+)\b/i;
  lines.forEach((l, i) => {
    if (dayRe.test(l)) dayStarts.push(i);
  });
  if (dayStarts.length < 2) return null;
  const intro = lines.slice(0, dayStarts[0]).join("\n").trim();
  const days = dayStarts.map((start, di) => {
    const end = di + 1 < dayStarts.length ? dayStarts[di + 1] : lines.length;
    const label = `Day ${dayRe.exec(lines[start])?.[1] ?? di + 1}`;
    // The header line usually reads "**Day 1: Arrays & Hashing**" — stripping
    // the Day-N prefix used to leave an unbalanced "**" (stray asterisks in
    // the card) and the title duplicated into the body text. Clean the header
    // remainder separately and re-bold it as the card's title line.
    const headRest = lines[start]
      .replace(dayRe, "")
      .replace(/\*+/g, "")
      .replace(/^\s*[:\-–—]\s*/, "")
      .trim();
    const rest = lines.slice(start + 1, end).join("\n").trim();
    const body = [headRest ? `**${headRest}**` : null, rest].filter(Boolean).join("\n").trim();
    return { label, body };
  });
  return { intro, days };
}

function TopicAnswer({ res }: { res: AskResponse }) {
  const intent = res.intent as "TOPIC_WEIGHTAGE" | "STUDY_GUIDE";
  const subject = res.subject ?? "";
  const topics = res.topics ?? [];
  const totalExams = res.total_exams ?? null;
  const dayPlan = intent === "STUDY_GUIDE" ? splitDayPlan(res.answer) : null;
  return (
    <div data-testid={intent === "STUDY_GUIDE" ? "study-guide-answer" : "topic-weightage-answer"}>
      <span className="mb-2 inline-block rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
        {intent === "STUDY_GUIDE" ? "Study plan" : "Topic weightage"}
      </span>
      <StatStrip
        totalExams={totalExams}
        topicCount={res.topic_count}
        topics={topics}
        smallCorpus={res.small_corpus === true}
      />
      {dayPlan ? (
        <div data-testid="day-plan">
          {dayPlan.intro && <Prose>{dayPlan.intro}</Prose>}
          <ol className="mt-2 space-y-2.5">
            {dayPlan.days.map((d) => (
              <li
                key={d.label}
                className="rounded-xl border border-accent/60 bg-secondary p-3.5 shadow-sm"
              >
                <span className="mb-1 inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
                  {d.label}
                </span>
                <Prose>{d.body}</Prose>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Prose>{res.answer}</Prose>
      )}
      {topics.length > 0 &&
        (intent === "TOPIC_WEIGHTAGE" ? (
          <ol className="mt-3 space-y-3.5">
            {topics.map((t, i) => (
              <TopicItem
                key={t.topic}
                subject={subject}
                topic={t}
                rank={i + 1}
                totalExams={totalExams}
                smallCorpus={res.small_corpus === true}
              />
            ))}
          </ol>
        ) : (
          <details className="mt-3 border-t border-accent/60 pt-2">
            <summary className="flex min-h-11 cursor-pointer select-none items-center text-xs font-semibold text-content/60 hover:text-brand">
              The data behind this plan ({topics.length} topics)
            </summary>
            <ol className="mt-2 space-y-3">
              {topics.map((t, i) => (
                <TopicItem
                  key={t.topic}
                  subject={subject}
                  topic={t}
                  rank={i + 1}
                  totalExams={totalExams}
                  smallCorpus={res.small_corpus === true}
                />
              ))}
            </ol>
          </details>
        ))}
    </div>
  );
}

function TopicItem({
  subject,
  topic: t,
  rank,
  totalExams,
  smallCorpus = false,
}: {
  subject: string;
  topic: TopicResult;
  rank: number;
  totalExams: number | null;
  smallCorpus?: boolean;
}) {
  const span =
    t.years.length === 0
      ? null
      : t.years.length === 1
        ? t.years[0]
        : `${t.years[0]}–${t.years[t.years.length - 1]}`;
  const tier = smallCorpus ? null : priorityTier(t.exam_count, totalExams);
  return (
    <li className="rounded-xl border border-accent/60 bg-secondary p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{t.topic}</p>
            <BigCount count={t.exam_count} total={totalExams} />
          </div>
          <CoverageBar count={t.exam_count} total={totalExams} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tier && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tier.classes}`}>
                {tier.label}
              </span>
            )}
            {span && <MutedPill>{span}</MutedPill>}
            {t.total_marks != null && <MutedPill>{t.total_marks} marks</MutedPill>}
          </div>
          {t.questions.length > 0 && (
            <TopicQuestionList
              subject={subject}
              topic={t.topic}
              preview={t.questions}
              total={t.cluster_count}
            />
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- year trend ---------- */

const STATUS_STYLES: Record<string, string> = {
  rising: "bg-brand/15 text-brand",
  staple: "bg-accent text-content/80",
  fading: "bg-content/5 text-content/50",
};

function YearTrendAnswer({
  answer,
  trend,
}: {
  answer: string;
  trend: { years: string[]; topics: TrendTopicResult[] } | null;
}) {
  return (
    <div data-testid="year-trend-answer">
      <span className="mb-2 mr-1.5 inline-block rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
        Year-wise trend
      </span>
      <MethodNote />
      <Prose>{answer}</Prose>
      {trend && trend.topics.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-accent/60">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr className="bg-secondary text-content/60">
                <th className="px-3 py-2 text-left font-medium">Topic</th>
                {trend.years.map((y) => (
                  <th key={y} className="px-2 py-2 text-center font-medium tabular-nums">
                    ’{y.slice(2)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/60">
              {trend.topics.map((t) => (
                <tr key={t.topic} className="bg-secondary/60">
                  <td className="max-w-52 px-3 py-2">
                    <span className="line-clamp-2">{t.topic}</span>
                    {t.status && (
                      <span
                        className={`mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-semibold ${STATUS_STYLES[t.status]}`}
                      >
                        {t.status}
                      </span>
                    )}
                  </td>
                  {t.counts.map((n, i) => (
                    <td
                      key={trend.years[i]}
                      className={`px-2 py-2 text-center tabular-nums ${n === 0 ? "text-content/40" : "text-content"}`}
                    >
                      {n === 0 ? "·" : n}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-sm font-extrabold tabular-nums text-content">
                    {t.exam_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- semantic ---------- */

/**
 * Compact "Sources" rows — one per cited paper: file icon, name, year·exam
 * chips, and a real similarity match-% badge. Collapsed beyond the first few.
 * Rows carry data-source-file/ref so the citation-thread overlay can anchor to
 * them; the section is marked data-sources-active on the latest cited answer so
 * only that answer's rows draw threads.
 */
function Sources({
  citations,
  msgId,
  active,
  flashRef,
}: {
  citations: Citation[];
  msgId: number;
  active: boolean;
  flashRef: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (citations.length === 0) return null;
  const FIRST = 3;
  // Reveal a jumped-to row even when it's past the fold.
  const forceAll =
    flashRef != null && citations.findIndex((c) => c.ref === flashRef) >= FIRST;
  const shown = showAll || forceAll ? citations : citations.slice(0, FIRST);
  return (
    <section
      data-sources-active={active ? "" : undefined}
      className="mt-3 border-t border-accent/60 pt-3"
    >
      <h4 className="mb-2 text-xs font-semibold text-content/60">Sources</h4>
      <ul className="space-y-1.5">
        {shown.map((c) => (
          <li key={c.ref}>
            <a
              id={`cite-${msgId}-${c.ref}`}
              data-source-file={c.file_name}
              data-source-ref={c.ref}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              title={c.question_text}
              className={`flex items-center gap-2.5 rounded-lg border border-accent/60 bg-secondary px-2.5 py-2 transition-colors hover:border-accent hover:bg-accent/20 ${flashRef === c.ref ? "cite-flash" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/60">
                <FileText size={16} weight="duotone" className="text-content/80" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-content">
                  {c.file_name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-content/60">
                  {known(c.year) && (
                    <span className="rounded-md bg-accent/20 px-1.5 py-0.5 font-medium">
                      {c.year}
                    </span>
                  )}
                  {known(c.exam_type) && (
                    <span className="rounded-md bg-primary/60 px-1.5 py-0.5 font-medium">
                      {c.exam_type}
                    </span>
                  )}
                  {c.marks != null && <span>{c.marks} marks</span>}
                </span>
              </span>
              {typeof c.similarity === "number" && (
                <span
                  className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand"
                  title="Similarity to your question"
                >
                  {Math.round(c.similarity * 100)}%
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      {citations.length > FIRST && !forceAll && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1.5 flex min-h-11 items-center text-xs font-medium text-content/60 hover:text-brand"
        >
          {showAll ? "Show fewer" : `${citations.length - FIRST} more`}
        </button>
      )}
    </section>
  );
}

function SemanticAnswer({
  answer,
  citations,
  msgId,
  threadActive = false,
}: {
  answer: string;
  citations: Citation[];
  msgId: number;
  threadActive?: boolean;
}) {
  const [flashRef, setFlashRef] = useState<number | null>(null);

  // Turn bare [n] markers into markdown links the renderer below intercepts.
  // Comma/and groups like [1, 5] or [1, 3, 5, and 6] expand to one chip per
  // number; adjacent markers like [1][7] are split — flush chips read as a
  // bare "17" — and the link text avoids nested brackets ("c1", never
  // rendered: the chip shows the number parsed from the href).
  // The (?!\() lookaheads leave real markdown links like [text](url) alone.
  const processed = answer
    .replace(/\[(\d+(?:[\s,&]+(?:and\s+)?\d+)+)\](?!\()/gi, (_m, group: string) =>
      (group.match(/\d+/g) ?? []).map((n) => `[c${n}](#cite-${n})`).join(" "),
    )
    .replace(/\](?=\[\d+\])/g, "] ")
    .replace(/\[(\d+)\](?!\()/g, (_m, n) => `[c${n}](#cite-${n})`);

  const jumpTo = (ref: number) => {
    setFlashRef(ref);
    requestAnimationFrame(() => {
      document
        .getElementById(`cite-${msgId}-${ref}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setFlashRef(null), 1700);
  };

  return (
    <div data-testid="semantic-answer">
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-li:my-0.5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const cite = href?.match(/^#cite-(\d+)$/);
              if (cite) {
                const ref = Number(cite[1]);
                return (
                  // muted superscript footnote chip — prose reads cleanly
                  <button
                    type="button"
                    onClick={() => jumpTo(ref)}
                    className="mx-px inline-flex -translate-y-1 items-center rounded px-0.5 align-super text-[10px] font-medium text-brand/80 no-underline hover:text-brand"
                    title={`Show source ${ref}`}
                  >
                    {ref}
                  </button>
                );
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {processed}
        </ReactMarkdown>
      </div>

      <Sources
        citations={citations}
        msgId={msgId}
        active={threadActive}
        flashRef={flashRef}
      />
    </div>
  );
}
