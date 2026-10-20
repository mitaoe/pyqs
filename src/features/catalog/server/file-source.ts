import { readFile } from "node:fs/promises"
import path from "node:path"
import { selectSubjectPapers } from "../papers"
import type { CatalogResponse, CatalogSnapshot } from "../types"
import { CatalogUnavailableError, type CatalogSource } from "./source"

export function createFileSource(filePath: string): CatalogSource {
  let snapshot: Promise<CatalogSnapshot> | null = null

  const load = () => {
    snapshot ??= readSnapshotFile(path.resolve(filePath)).catch((error) => {
      snapshot = null
      throw error
    })
    return snapshot
  }

  return {
    async readSubjectNames() {
      return (await load()).meta.standardSubjects
    },
    async readSubjectPapers(subject) {
      return selectSubjectPapers((await load()).papers, subject)
    },
    readSnapshot: load,
  }
}

async function readSnapshotFile(filePath: string): Promise<CatalogSnapshot> {
  let body: CatalogResponse
  try {
    body = JSON.parse(await readFile(filePath, "utf8"))
  } catch (error) {
    throw new CatalogUnavailableError(
      `Could not read the catalog file ${filePath}: ${(error as Error).message}`,
    )
  }

  const { papers, ...meta } = body?.meta ?? {}
  if (!Array.isArray(papers) || !Array.isArray(meta.standardSubjects)) {
    throw new CatalogUnavailableError(
      `${filePath} is not a GET /api/papers response (meta.papers is missing)`,
    )
  }

  return { papers, meta, stats: body.stats }
}
