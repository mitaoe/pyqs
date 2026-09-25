import { NextResponse } from "next/server";

import { getStats } from "@/lib/rag/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never prerender at build time (needs DB)

export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("GET /api/stats failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
