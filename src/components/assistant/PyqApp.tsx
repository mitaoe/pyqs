"use client";

import { useEffect, useState } from "react";

import type { SubjectRow } from "@/lib/rag/api-types";
import Chat from "./Chat";
import StatsFooter from "./StatsFooter";
import SubjectPicker from "./SubjectPicker";

const SUBJECT_KEY = "pyq.subject";

export default function PyqApp() {
  const [subjects, setSubjects] = useState<SubjectRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);

  async function loadSubjects() {
    setLoadError(null);
    try {
      const res = await fetch("/api/subjects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { subjects: SubjectRow[] };
      setSubjects(body.subjects);
      // Restore the last-used subject only if it still exists.
      const saved = localStorage.getItem(SUBJECT_KEY);
      if (saved && body.subjects.some((s) => s.subject === saved)) setSubject(saved);
    } catch {
      setLoadError("Couldn't load the subject list. The database may be waking up.");
    }
  }

  useEffect(() => {
    void loadSubjects();
  }, []);

  function pickSubject(s: string) {
    localStorage.setItem(SUBJECT_KEY, s);
    setSubject(s);
  }

  if (subject && subjects) {
    return (
      <Chat
        subject={subject}
        questionCount={subjects.find((s) => s.subject === subject)?.question_count ?? null}
        onChangeSubject={() => {
          localStorage.removeItem(SUBJECT_KEY);
          setSubject(null);
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 pb-10">
      <header className="pb-6 pt-10 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-content">
          MITAoE <span className="text-brand">PYQ</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-content/60">
          Pick your subject, then ask anything about previous-year question papers — real
          frequency counts and answers grounded in actual questions.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-300">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setSubjects(null);
              void loadSubjects();
            }}
            className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : subjects ? (
        <SubjectPicker subjects={subjects} onSelect={pickSubject} />
      ) : (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-12 animate-pulse rounded-xl bg-accent" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      )}

      <StatsFooter />
      </div>
    </div>
  );
}
