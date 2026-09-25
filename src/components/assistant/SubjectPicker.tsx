"use client";

import { useMemo, useState } from "react";

import type { SubjectRow } from "@/lib/rag/api-types";

export default function SubjectPicker({
  subjects,
  onSelect,
}: {
  subjects: SubjectRow[];
  onSelect: (subject: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = [...subjects].sort((a, b) => b.question_count - a.question_count);
    if (!q) return ranked;
    return ranked.filter((s) => s.subject.toLowerCase().includes(q));
  }, [subjects, query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your subject…"
        autoComplete="off"
        className="w-full rounded-xl border border-accent bg-secondary px-4 py-3 text-base text-content shadow-sm outline-none placeholder:text-content/50 focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
      <p className="mt-2 px-1 text-xs text-content/60">
        {filtered.length} of {subjects.length} subjects
      </p>
      <ul className="mt-2 divide-y divide-accent/60 overflow-hidden rounded-xl border border-accent/60 bg-secondary shadow-sm">
        {filtered.slice(0, 60).map((s) => (
          <li key={s.subject}>
            <button
              type="button"
              onClick={() => onSelect(s.subject)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent active:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{s.subject}</span>
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs tabular-nums text-content/80">
                {s.question_count.toLocaleString()} questions
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-content/60">
            No subject matches “{query}”.
          </li>
        )}
      </ul>
      {filtered.length > 60 && (
        <p className="mt-2 px-1 text-xs text-content/50">
          Showing the 60 largest matches — keep typing to narrow down.
        </p>
      )}
    </div>
  );
}
