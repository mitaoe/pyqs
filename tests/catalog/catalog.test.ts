import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LEGACY_BASE_URL, PDF_BASE_URL } from "@/config/urls"
import fixture from "../fixtures/catalog.json"

const FIXTURE = path.resolve(__dirname, "../fixtures/catalog.json")

async function loadCatalog(env: Record<string, string | undefined>) {
  vi.resetModules()
  vi.unstubAllEnvs()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import("@/features/catalog/server/catalog")
}

async function writeCatalog(body: unknown) {
  const dir = await mkdtemp(path.join(tmpdir(), "pyqs-catalog-"))
  const file = path.join(dir, "catalog.json")
  await writeFile(file, JSON.stringify(body))
  return file
}

afterEach(() => vi.unstubAllEnvs())

describe("catalog service with a file source", () => {
  it("lists subjects in catalog order", async () => {
    const { getSubjectNames } = await loadCatalog({ CATALOG_FILE: FIXTURE, MONGODB_URI: undefined })
    expect(await getSubjectNames()).toEqual(fixture.meta.standardSubjects)
  })

  it("returns a subject's papers as summaries, matched case-insensitively", async () => {
    const { getSubjectPapers } = await loadCatalog({
      CATALOG_FILE: FIXTURE,
      MONGODB_URI: undefined,
    })
    const papers = await getSubjectPapers("computer networks")
    const expected = fixture.meta.papers.filter((p) => p.standardSubject === "Computer Networks")

    expect(papers).toHaveLength(expected.length)
    expect(Object.keys(papers[0]).sort()).toEqual([
      "examType",
      "fileName",
      "standardSubject",
      "subject",
      "url",
      "year",
    ])
    expect(papers.map((p) => p.fileName)).toEqual(expected.map((p) => p.fileName))
  })

  it("serves /api/papers in the original shape", async () => {
    const { getCatalogResponse } = await loadCatalog({
      CATALOG_FILE: FIXTURE,
      MONGODB_URI: undefined,
    })
    const body = await getCatalogResponse()

    expect(Object.keys(body)).toEqual(["meta", "lastUpdated", "stats"])
    expect(Object.keys(body.meta)).toEqual(Object.keys(fixture.meta))
    expect(body.meta.papers).toHaveLength(fixture.meta.papers.length)
    expect(body.lastUpdated).toBe(fixture.stats.lastUpdated)
  })

  it("points legacy college-server URLs at paper storage", async () => {
    const legacy = {
      ...fixture,
      meta: {
        ...fixture.meta,
        papers: [{ ...fixture.meta.papers[0], url: `${LEGACY_BASE_URL}/DigitalLibrary/a.pdf` }],
      },
    }
    const { getCatalogResponse, getSubjectPapers } = await loadCatalog({
      CATALOG_FILE: await writeCatalog(legacy),
      MONGODB_URI: undefined,
    })

    expect((await getCatalogResponse()).meta.papers[0].url).toBe(
      `${PDF_BASE_URL}/DigitalLibrary/a.pdf`,
    )
    const [only] = await getSubjectPapers(legacy.meta.papers[0].standardSubject)
    expect(only.url).toBe(`${PDF_BASE_URL}/DigitalLibrary/a.pdf`)
  })

  it("explains a malformed catalog file", async () => {
    const { getSubjectNames } = await loadCatalog({
      CATALOG_FILE: await writeCatalog({ hello: "world" }),
      MONGODB_URI: undefined,
    })
    await expect(getSubjectNames()).rejects.toThrow(/not a GET \/api\/papers response/)
  })

  it("refuses to guess when no source is configured", async () => {
    const { getSubjectNames } = await loadCatalog({
      CATALOG_FILE: undefined,
      MONGODB_URI: undefined,
    })
    expect(() => getSubjectNames()).toThrow(/No catalog source configured/)
  })
})
