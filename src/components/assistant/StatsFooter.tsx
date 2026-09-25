"use client";

import { useEffect, useState } from "react";

import type { StatsResponse } from "@/lib/rag/api-types";

export default function StatsFooter() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s: StatsResponse) => setStats(s))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <footer className="mt-10 pb-8 text-center text-xs text-content/60" data-testid="stats-footer">
      {stats ? (
        <p>
          {stats.questions.total.toLocaleString()} questions · {(stats.papers.done ?? 0).toLocaleString()}{" "}
          papers · {stats.subjects.length} subjects — extracted from real MITAoE exam PDFs
        </p>
      ) : (
        <p className="animate-pulse">Loading corpus stats…</p>
      )}
      <p className="mt-1">
        Open source ·{" "}
        <a
          href="https://github.com/tejaspatil1936/pyq-rag"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
