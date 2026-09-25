import { NextResponse } from "next/server";

import { listSubjects } from "@/lib/rag/subjects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never prerender at build time (needs DB)

export async function GET() {
  try {
    const subjects = await listSubjects();
    return NextResponse.json(
      { subjects },
      // Subject list only changes when the pipeline runs; let the CDN hold it.
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
