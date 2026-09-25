"use client";

import { useEffect, useRef, useState } from "react";

import type { AskResponse } from "@/lib/rag/api-types";
import AnswerView from "./AnswerView";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; res: AskResponse }
  | { id: number; role: "error"; text: string; retryQuestion: string };

// Each button carries its intent, so the server skips classification and the
// request costs ZERO LLM calls — all three land on SQL-only paths.
const QUICK_ACTIONS = [
  {
    label: "Most repeated questions",
    question: "What are the most repeated questions?",
    intent: "ANALYTICS",
  },
  {
    label: "Topic-wise weightage",
    question: "Show me the topic-wise weightage",
    intent: "TOPIC_WEIGHTAGE",
  },
  { label: "Year-wise trend", question: "Show me the year-wise trends", intent: "YEAR_TREND" },
] as const;

export default function Chat({
  subject,
  questionCount,
  onChangeSubject,
  embedded = false,
}: {
  subject: string;
  questionCount: number | null;
  onChangeSubject: () => void;
  /** When hosted in the AskAI panel, the panel owns the top bar — hide ours. */
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  async function send(question: string, intent?: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    // Last few turns as plain text so the server can resolve follow-ups
    // ("explain the second one"); the server enforces its own caps.
    const history = messages
      .flatMap((m): { role: "user" | "assistant"; content: string }[] =>
        m.role === "user"
          ? [{ role: "user", content: m.text }]
          : m.role === "assistant"
            ? [{ role: "assistant", content: m.res.answer }]
            : [],
      )
      .slice(-6);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, question: q, history, ...(intent ? { intent } : {}) }),
      });
      const body = (await res.json()) as AskResponse & { error?: string };
      if (!res.ok) {
        throw new Error(
          body.error ??
            (res.status === 503 ? "The AI backend is busy — try again in a minute." : `HTTP ${res.status}`),
        );
      }
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", res: body }]);
    } catch (err) {
      const text =
        err instanceof TypeError
          ? "Network error — check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setMessages((m) => [...m, { id: nextId.current++, role: "error", text, retryQuestion: q }]);
    } finally {
      setLoading(false);
    }
  }

  // Only the latest answer owns the citation threads: they clear the moment a
  // new question is sent (last message becomes the user's) and stay cleared if
  // that answer carries no citations (analytics, greeting, refusal).
  const last = messages[messages.length - 1];
  const latestCitedId: number | null =
    last && last.role === "assistant" && (last.res.citations?.length ?? 0) > 0
      ? last.id
      : null;

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
        <header className="sticky top-0 z-10 border-b border-accent/60 bg-primary/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold">{subject}</h1>
              {questionCount != null && (
                <p className="text-xs text-content/60">
                  {questionCount.toLocaleString()} questions from past papers
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-content/80 hover:bg-accent"
                >
                  New chat
                </button>
              )}
              <button
                type="button"
                onClick={onChangeSubject}
                className="rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-content/80 hover:bg-accent"
              >
                Change subject
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
          {messages.length === 0 && !loading && (
            <div className="py-10 text-center">
              <p className="text-lg font-semibold text-content">
                Ask anything about {subject} papers
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-content/60">
                Frequency questions get real counts from the archive. Open-ended questions get
                answers grounded in actual past questions, with sources.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end" data-msg-role="user">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">
                    {msg.text}
                  </div>
                </div>
              );
            }
            if (msg.role === "error") {
              return (
                <div key={msg.id} className="flex" data-msg-role="error">
                  <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                    <p>{msg.text}</p>
                    <button
                      type="button"
                      onClick={() => send(msg.retryQuestion)}
                      className="mt-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex" data-msg-role="assistant">
                <div className="w-full max-w-[95%] rounded-2xl rounded-bl-md border border-accent/60 bg-secondary px-4 py-3 shadow-sm">
                  <AnswerView
                    res={msg.res}
                    msgId={msg.id}
                    threadActive={msg.id === latestCitedId}
                  />
                </div>
              </div>
            );
          })}

          {loading && <LoadingBubble />}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="askai-glass border-t border-accent/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                disabled={loading}
                onClick={() => send(qa.question, qa.intent)}
                className="min-h-11 shrink-0 rounded-full border border-brand/40 bg-brand/10 px-3.5 text-xs font-medium text-brand hover:bg-brand/20 disabled:opacity-50"
              >
                {qa.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${subject}…`}
              maxLength={1000}
              enterKeyHint="send"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-accent bg-secondary px-4 text-sm text-content outline-none placeholder:text-content/50 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

/** Escalating status so a ~10s cold start never looks like a frozen page. */
function LoadingBubble() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  const hints = [
    "Thinking…",
    "Searching the question paper archive…",
    "Cold start — warming up the search model, a few more seconds…",
  ];
  return (
    <div className="flex" data-msg-role="loading">
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-accent/60 bg-secondary px-4 py-3 shadow-sm">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-brand border-t-transparent motion-safe:animate-spin" />
        </span>
        <span className="text-sm text-content/60" aria-live="polite">
          {hints[phase]}
        </span>
      </div>
    </div>
  );
}
