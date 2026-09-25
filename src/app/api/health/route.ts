import { NextResponse } from "next/server";

import { cacheStats, corpusVersion } from "@/lib/rag/cache";
import { getPool } from "@/lib/rag/db";
import { GEMINI_MODEL } from "@/lib/rag/gemini";
import { keyAvailability } from "@/lib/rag/key-rotator";
import { laneHealth } from "@/lib/rag/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness plus the two numbers that actually decide whether the site
 * survives a busy day: which provider each lane can still reach, and how much
 * traffic the cache is absorbing.
 *
 * Provider counters are per-instance (serverless instances share no memory),
 * so read them as a sample of where today's quota went, not a global total.
 * `ok` stays narrow on purpose — DB reachable and at least one usable
 * provider per lane — so an uptime monitor pages for outages, not for a
 * single benched provider.
 */
export async function GET() {
  const t0 = Date.now();
  let db: { ok: boolean; latency_ms: number | null } = { ok: false, latency_ms: null };
  try {
    await getPool().query("SELECT 1");
    db = { ok: true, latency_ms: Date.now() - t0 };
  } catch (err) {
    console.error("health: DB check failed:", err);
  }

  const lanes = {
    classification: laneHealth("classification"),
    synthesis: laneHealth("synthesis"),
  };

  // A lane is usable while ANY provider in its ladder is; classification can
  // additionally fall back to regex-only and synthesis to degraded mode, so
  // neither going dark is fatal — it is just worth alerting on.
  const laneUsable = {
    classification: lanes.classification.some((p) => p.available),
    synthesis: lanes.synthesis.some((p) => p.available),
  };

  const { total, available, benched } = keyAvailability();

  const body = {
    ok: db.ok && laneUsable.synthesis,
    db,
    lanes,
    lane_available: laneUsable,
    // Gemini's per-key detail, which the lane view can't express (it is one
    // provider holding N rotating keys). Kept at the top level for the
    // existing uptime checks.
    gemini: {
      configured: total > 0,
      keys: total,
      available,
      benched,
      model: GEMINI_MODEL,
    },
    cache: { ...cacheStats(), corpus_version: await corpusVersion() },
  };
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
