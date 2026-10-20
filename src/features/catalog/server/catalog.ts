import { cache } from "react"
import { rewritePaperUrls } from "../pdf-url"
import { toPaperSummary, type CatalogResponse, type PaperSummary } from "../types"
import { createFileSource } from "./file-source"
import { createMongoSource } from "./mongo-source"
import type { CatalogSource } from "./source"

let source: CatalogSource | null = null

function catalogSource(): CatalogSource {
  if (source) return source

  const file = process.env.CATALOG_FILE
  const mongoUri = process.env.MONGODB_URI

  if (file) {
    source = createFileSource(file)
  } else if (mongoUri) {
    source = createMongoSource(mongoUri)
  } else {
    throw new Error(
      "No catalog source configured. Set MONGODB_URI, or CATALOG_FILE to a saved GET /api/papers response (see README).",
    )
  }
  return source
}

const SUBJECT_NAMES_TTL_MS = 5 * 60 * 1000
let subjectNames: { value: Promise<string[]>; expires: number } | null = null

export const getSubjectNames = cache((): Promise<string[]> => {
  if (!subjectNames || subjectNames.expires < Date.now()) {
    const value = catalogSource()
      .readSubjectNames()
      .catch((error) => {
        subjectNames = null
        throw error
      })
    subjectNames = { value, expires: Date.now() + SUBJECT_NAMES_TTL_MS }
  }
  return subjectNames.value
})

export const getSubjectPapers = cache(async (subject: string): Promise<PaperSummary[]> => {
  const papers = await catalogSource().readSubjectPapers(subject)
  return rewritePaperUrls(papers).map(toPaperSummary)
})

export async function getCatalogResponse(): Promise<CatalogResponse> {
  const snapshot = await catalogSource().readSnapshot()
  return {
    meta: { ...snapshot.meta, papers: rewritePaperUrls(snapshot.papers) },
    lastUpdated: snapshot.stats.lastUpdated,
    stats: snapshot.stats,
  }
}

export function resetCatalogSourceForTests() {
  source = null
  subjectNames = null
}
