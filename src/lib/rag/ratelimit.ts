import { createHash } from "node:crypto";

/**
 * Per-IP sliding-window rate limits, in memory (per warm instance — an
 * accepted approximation; the runtime Gemini key's own quota is the hard
 * backstop). IPs are never stored raw: only a salted hash lives in memory
 * and appears in logs.
 *
 * Two tiers: a generous total cap on /api/ask, and a strict cap on Gemini
 * SYNTHESIS calls only — analytics stay SQL-only and effectively uncapped.
 * Limits are read from env at call time so tests can tune them.
 */

const WINDOW_MS = 60 * 60 * 1000;

const globalForRl = globalThis as unknown as { pyqRlBuckets?: Map<string, number[]> };

function buckets() {
  globalForRl.pyqRlBuckets ??= new Map();
  return globalForRl.pyqRlBuckets;
}

export function synthLimit(): number {
  return Number(process.env.RATE_LIMIT_SYNTH_PER_HOUR ?? 10);
}

export function totalLimit(): number {
  return Number(process.env.RATE_LIMIT_TOTAL_PER_HOUR ?? 120);
}

/** Salted hash — the only identifier ever kept or logged. */
export function rateKey(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "pyq-static-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

export function ipFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Consume one slot from `bucket` (e.g. "total:abcd" / "synth:abcd"). */
export function consume(bucket: string, limit: number): boolean {
  const now = Date.now();
  const hits = (buckets().get(bucket) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= limit) {
    buckets().set(bucket, hits);
    return false;
  }
  hits.push(now);
  buckets().set(bucket, hits);
  return true;
}
