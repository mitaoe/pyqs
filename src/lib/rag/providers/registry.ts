/**
 * Per-provider runtime state, shared by every lane on a warm instance:
 * bench windows, today's call counts, and the sticky preflight verdict.
 *
 * Same serverless caveat as the key rotator: instances share no state, so
 * these counters are per-instance approximations. That is fine for what they
 * are used for — skipping a provider we just saw 429, and giving /api/health
 * a real (if instance-local) picture of where the day's quota went. The
 * provider's own quota is always the hard backstop.
 *
 * Counters roll over at UTC midnight, matching every free tier's reset.
 */

import type { Lane, ProviderName } from "./types";

export type PreflightStatus = "unknown" | "ok" | "dead";

interface ProviderState {
  /** epoch ms; 0 = available */
  benchedUntil: number;
  /** why it is benched, for /api/health */
  benchReason: string | null;
  callsToday: number;
  errorsToday: number;
  /** UTC date key the counters belong to */
  day: string;
  /** keyed by `${lane}:${model}` so a model swap re-preflights */
  preflight: Map<string, { status: PreflightStatus; detail: string | null }>;
  lastOutcome: string | null;
}

interface RegistryStore {
  providers: Map<ProviderName, ProviderState>;
}

const globalForRegistry = globalThis as unknown as { pyqProviderRegistry?: RegistryStore };

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function store(): RegistryStore {
  globalForRegistry.pyqProviderRegistry ??= { providers: new Map() };
  return globalForRegistry.pyqProviderRegistry;
}

function state(name: ProviderName): ProviderState {
  const s = store();
  let st = s.providers.get(name);
  if (!st) {
    st = {
      benchedUntil: 0,
      benchReason: null,
      callsToday: 0,
      errorsToday: 0,
      day: utcDay(),
      preflight: new Map(),
      lastOutcome: null,
    };
    s.providers.set(name, st);
  }
  // Daily rollover: counters reset and a day-bench expires with the day.
  const today = utcDay();
  if (st.day !== today) {
    st.day = today;
    st.callsToday = 0;
    st.errorsToday = 0;
    if (st.benchedUntil > Date.now() && st.benchReason === "daily-quota") {
      st.benchedUntil = 0;
      st.benchReason = null;
    }
  }
  return st;
}

export function isBenched(name: ProviderName): boolean {
  return state(name).benchedUntil > Date.now();
}

export function benchUntilReason(name: ProviderName): { until: number; reason: string | null } {
  const st = state(name);
  return { until: st.benchedUntil, reason: st.benchReason };
}

/** Short cooldown — per-minute 429s, 5xx, network blips. */
export function benchProvider(name: ProviderName, ms: number, reason: string): void {
  const st = state(name);
  st.benchedUntil = Math.max(st.benchedUntil, Date.now() + ms);
  st.benchReason = reason;
}

/** Daily-quota 429: out until the next UTC day (+30s grace). */
export function benchProviderForDay(name: ProviderName): void {
  const next = new Date();
  next.setUTCHours(24, 0, 30, 0);
  benchProvider(name, next.getTime() - Date.now(), "daily-quota");
}

export function recordCall(name: ProviderName, outcome: string): void {
  const st = state(name);
  st.callsToday += 1;
  st.lastOutcome = outcome;
  if (outcome !== "ok") st.errorsToday += 1;
}

export function preflightStatus(
  name: ProviderName,
  lane: Lane,
  model: string,
): { status: PreflightStatus; detail: string | null } {
  return state(name).preflight.get(`${lane}:${model}`) ?? { status: "unknown", detail: null };
}

export function setPreflight(
  name: ProviderName,
  lane: Lane,
  model: string,
  status: PreflightStatus,
  detail: string | null = null,
): void {
  state(name).preflight.set(`${lane}:${model}`, { status, detail });
}

export interface ProviderSnapshot {
  provider: ProviderName;
  calls_today: number;
  errors_today: number;
  benched: boolean;
  benched_until: string | null;
  bench_reason: string | null;
  last_outcome: string | null;
}

/** /api/health: what this instance has seen today, per provider. */
export function snapshot(name: ProviderName): ProviderSnapshot {
  const st = state(name);
  const benched = st.benchedUntil > Date.now();
  return {
    provider: name,
    calls_today: st.callsToday,
    errors_today: st.errorsToday,
    benched,
    benched_until: benched ? new Date(st.benchedUntil).toISOString() : null,
    bench_reason: benched ? st.benchReason : null,
    last_outcome: st.lastOutcome,
  };
}

/** Test-only: forget every provider's bench/counters/preflight verdict. */
export function _resetProviderRegistryForTests(): void {
  globalForRegistry.pyqProviderRegistry = undefined;
}
