import JSZip from "jszip"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BatchDownloadProgress } from "@/features/downloads/types"

const cache = new Map<string, ArrayBuffer>()
const saved: { blob: Blob; fileName: string }[] = []

vi.mock("@/features/downloads/pdf-cache/manager", () => ({
  getCacheManager: () => ({
    getPdf: async (url: string) => cache.get(url) ?? null,
    storePdf: async (url: string, data: ArrayBuffer) => void cache.set(url, data),
  }),
}))
vi.mock("@/features/downloads/save-blob", () => ({
  saveBlob: (blob: Blob, fileName: string) => saved.push({ blob, fileName }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const { batchDownloadPapers, MAX_BATCH_PAPERS } =
  await import("@/features/downloads/batch-download")
const { toast } = await import("sonner")

const paper = (n: number) => ({
  url: `https://pdf.example/${n}.pdf`,
  fileName: `Paper ${n}`,
  subject: "CN",
  standardSubject: "Computer Networks",
  year: "2024",
})

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer

async function run(papers: ReturnType<typeof paper>[], filters = {}) {
  const updates: BatchDownloadProgress[] = []
  const result = await batchDownloadPapers(papers, filters, (p) => updates.push(p))
  return { result, updates, last: updates[updates.length - 1] }
}

beforeEach(() => {
  cache.clear()
  saved.length = 0
  vi.mocked(toast.error).mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/404.")
        ? new Response("missing", { status: 404 })
        : new Response(bytes(`pdf:${url}`)),
    ),
  )
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 })
})

describe("batchDownloadPapers", () => {
  it("zips every paper, uses the cache first and stores what it fetched", async () => {
    cache.set(paper(2).url, bytes("cached-2"))

    const { result, last, updates } = await run([paper(1), paper(2), paper(3)], { years: ["2024"] })

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(cache.has(paper(1).url) && cache.has(paper(3).url)).toBe(true)
    expect(updates.some((u) => u.currentPaper === "1 cached • 2 to download")).toBe(true)
    expect(last).toMatchObject({
      status: "complete",
      percentage: 100,
      currentPaper: "3 papers downloaded",
    })

    expect(saved).toHaveLength(1)
    expect(saved[0].fileName).toBe("Computer_Networks_Papers_2024.zip")
    const zip = await JSZip.loadAsync(await saved[0].blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(["Paper 1.pdf", "Paper 2.pdf", "Paper 3.pdf"])
    expect(await zip.file("Paper 2.pdf")!.async("string")).toBe("cached-2")
  })

  it("reports progress that only moves forward through the phases", async () => {
    const { updates } = await run([paper(1), paper(2)])
    const order = ["preparing", "downloading", "processing", "sending", "complete"]
    const phases = updates.map((u) => order.indexOf(u.status))
    expect(phases).toEqual([...phases].sort((a, b) => a - b))
    const percentages = updates.slice(2).map((u) => u.percentage ?? 0)
    expect(percentages).toEqual([...percentages].sort((a, b) => a - b))
  })

  it("keeps going when some papers fail and counts them", async () => {
    const broken = { ...paper(9), url: "https://pdf.example/404.pdf" }
    const { result, last } = await run([paper(1), broken])
    expect(result).toBe(true)
    expect(last).toMatchObject({
      status: "complete",
      failedCount: 1,
      currentPaper: "1 papers downloaded • 1 failed",
    })
  })

  it("fails when nothing could be fetched", async () => {
    const { result, last } = await run([{ ...paper(1), url: "https://pdf.example/404.pdf" }])
    expect(result).toBe(false)
    expect(last).toMatchObject({
      status: "error",
      error: "Failed to fetch any of the requested papers",
    })
    expect(saved).toHaveLength(0)
  })

  it("downloads each URL once and refuses more than the batch limit", async () => {
    await run([paper(1), paper(1), paper(2)])
    expect(fetch).toHaveBeenCalledTimes(2)

    const many = Array.from({ length: MAX_BATCH_PAPERS + 1 }, (_, i) => paper(i))
    const { result, last } = await run(many)
    expect(result).toBe(false)
    expect(last).toMatchObject({
      status: "error",
      error: "Maximum 50 papers can be downloaded at once",
    })
    expect(toast.error).toHaveBeenCalledWith("Maximum 50 papers can be downloaded at once")
  })
})
