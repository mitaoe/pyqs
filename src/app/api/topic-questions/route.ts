import { NextResponse } from "next/server";

import { MAX_TOPIC_CLUSTERS } from "@/lib/rag/config";
import { consume, ipFromHeaders, rateKey, totalLimit } from "@/lib/rag/ratelimit";
import { labelClusters } from "@/lib/rag/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Full question list for one canonical topic — lazy-loaded by the weightage
 * UI when a topic row is expanded, so the payload stays small until asked
 * for. Pure SQL, no Gemini.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = (url.searchParams.get("subject") ?? "").trim();
  const topic = (url.searchParams.get("topic") ?? "").trim();
  if (!subject || !topic) {
    return NextResponse.json({ error: "subject and topic are required" }, { status: 400 });
  }

  const client = rateKey(ipFromHeaders(req.headers));
  if (!consume(`total:${client}`, totalLimit())) {
    return NextResponse.json({ error: "too many requests this hour" }, { status: 429 });
  }

  try {
    const clusters = await labelClusters(subject, topic, MAX_TOPIC_CLUSTERS);
    return NextResponse.json(
      {
        topic,
        cluster_total: clusters.length,
        questions: clusters.map((c) => ({
          text: c.representative_text,
          exam_count: c.exam_count,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("GET /api/topic-questions failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
