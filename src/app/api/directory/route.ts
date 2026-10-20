import { NextResponse } from "next/server"
import Directory from "@/models/Directory"
import { connectToMongo } from "@/lib/mongodb"
import { rewriteDirectoryUrls } from "@/features/catalog/pdf-url"
import type { DirectoryDocument } from "@/types/paper"

export async function GET() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    return NextResponse.json({ error: "MONGODB_URI is not set" }, { status: 503 })
  }

  try {
    await connectToMongo(uri)

    const doc = (await Directory.findOne()
      .sort({ lastUpdated: -1 })
      .lean()) as DirectoryDocument | null

    if (!doc) {
      console.warn("No directory structure found in database")
      return NextResponse.json({ error: "No directory structure found" }, { status: 404 })
    }

    const structure = doc.structure
    if (!structure || !structure.children || typeof structure.children !== "object") {
      console.error("Invalid directory structure:", structure)
      return NextResponse.json({ error: "Invalid directory structure" }, { status: 500 })
    }

    const rewrittenStructure = rewriteDirectoryUrls(structure)

    return NextResponse.json({
      structure: rewrittenStructure,
      meta: rewrittenStructure.meta,
      stats: doc.stats,
      lastUpdated: doc.lastUpdated,
    })
  } catch (error) {
    console.error("Failed to fetch directory structure:", error)

    if (error instanceof Error && (error.name === "MongooseError" || error.name === "MongoError")) {
      return NextResponse.json(
        { error: "Database connection error", details: error.message },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to fetch directory structure",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
