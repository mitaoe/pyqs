import { toast } from "sonner"
import type { PaperFilters } from "@/features/catalog/papers"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getCacheManager } from "./pdf-cache/manager"
import { saveBlob } from "./save-blob"
import type { BatchDownloadProgress, DownloadablePaper, ProgressCallback } from "./types"
import { formatZipFilename, zipEntryName } from "./zip-filename"

export const MAX_BATCH_PAPERS = 50

const DOWNLOAD_START = 5
const DOWNLOAD_END = 85
const ZIP_END = 95

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function downloadPercentage(done: number, total: number): number {
  return DOWNLOAD_START + (done / total) * (DOWNLOAD_END - DOWNLOAD_START)
}

function uniqueByUrl<T extends { url: string }>(papers: T[]): T[] {
  const seenUrls = new Set<string>()
  return papers.filter((paper) => {
    if (seenUrls.has(paper.url)) return false
    seenUrls.add(paper.url)
    return true
  })
}

export async function batchDownloadPapers(
  papers: DownloadablePaper[],
  filters: Partial<PaperFilters> = {},
  onProgress?: ProgressCallback,
): Promise<boolean> {
  try {
    if (!papers || papers.length === 0) {
      toast.error("No papers selected for download")
      return false
    }

    const uniquePapers = uniqueByUrl(papers)

    if (uniquePapers.length > MAX_BATCH_PAPERS) {
      const errorMsg = `Maximum ${MAX_BATCH_PAPERS} papers can be downloaded at once`
      toast.error(errorMsg)
      onProgress?.({
        totalPapers: uniquePapers.length,
        completed: 0,
        status: "error",
        error: errorMsg,
        percentage: 0,
      })
      return false
    }

    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    const cacheManager = getCacheManager()

    const progress: BatchDownloadProgress = {
      totalPapers: uniquePapers.length,
      completed: 0,
      status: "preparing",
      percentage: 0,
      failedCount: 0,
    }
    const report = () => onProgress?.({ ...progress })

    report()

    const cachedPapers: Array<{ paper: DownloadablePaper; pdfData: ArrayBuffer }> = []
    const uncachedPapers: DownloadablePaper[] = []

    progress.status = "preparing"
    progress.currentPaper = "Checking cache for existing papers..."
    report()

    for (let i = 0; i < uniquePapers.length; i++) {
      const paper = uniquePapers[i]

      if (i % 5 === 0 || i === uniquePapers.length - 1) {
        progress.percentage = Math.round((i / uniquePapers.length) * 2)
        progress.currentPaper = `Checking cache... (${i + 1}/${uniquePapers.length})`
        report()
        await wait(10)
      }

      const cachedData = await cacheManager.getPdf(paper.url)
      if (cachedData) {
        cachedPapers.push({ paper, pdfData: cachedData })
      } else {
        uncachedPapers.push(paper)
      }
    }

    const cacheHitCount = cachedPapers.length
    const networkFetchCount = uncachedPapers.length

    await wait(400)
    progress.status = "downloading"
    progress.percentage = DOWNLOAD_START
    progress.completed = 0

    if (cacheHitCount > 0 && networkFetchCount > 0) {
      progress.currentPaper = `${cacheHitCount} cached • ${networkFetchCount} to download`
    } else if (cacheHitCount > 0) {
      progress.currentPaper = `${cacheHitCount} papers from cache`
    } else {
      progress.currentPaper = `${networkFetchCount} papers to download`
    }

    report()

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < cachedPapers.length; i++) {
      const { paper, pdfData } = cachedPapers[i]
      try {
        zip.file(zipEntryName(paper.fileName), pdfData)
        successCount++
      } catch (error) {
        console.error(`Error processing cached ${paper.fileName}:`, error)
        errorCount++
        progress.failedCount = errorCount
      }

      progress.completed = i + 1
      progress.percentage = downloadPercentage(progress.completed, uniquePapers.length)
      progress.currentPaper = `Downloading ${i + 1} of ${uniquePapers.length}`
      report()
    }

    for (let i = 0; i < uncachedPapers.length; i++) {
      const paper = uncachedPapers[i]
      try {
        progress.currentPaper = `Downloading ${cachedPapers.length + i + 1} of ${uniquePapers.length}`
        report()

        const response = await fetchWithTimeout(paper.url)

        if (!response.ok) {
          throw new Error(`status ${response.status}`)
        }

        const pdfData = await response.arrayBuffer()

        try {
          await cacheManager.storePdf(
            paper.url,
            pdfData,
            paper.fileName,
            paper.subject || "Unknown",
            paper.year || "Unknown",
          )
        } catch (cacheError) {
          console.warn("Failed to cache PDF:", cacheError)
        }

        zip.file(zipEntryName(paper.fileName), pdfData)
        successCount++
      } catch (error) {
        console.error(`Error processing ${paper.fileName}:`, error)
        errorCount++
        progress.failedCount = errorCount
      }

      progress.completed = cachedPapers.length + i + 1
      progress.percentage = downloadPercentage(progress.completed, uniquePapers.length)
      report()
    }

    if (successCount === 0) {
      progress.status = "error"
      progress.error = "Failed to fetch any of the requested papers"
      progress.percentage = 0
      report()
      return false
    }

    progress.completed = uniquePapers.length
    progress.status = "processing"
    progress.percentage = DOWNLOAD_END
    progress.currentPaper = `Compressing ${successCount} papers`
    progress.failedCount = errorCount
    report()

    let lastZipUpdate = 0
    const zipBlob = await zip.generateAsync(
      { type: "blob", compression: "STORE" },
      ({ percent }) => {
        const now = Date.now()
        if (now - lastZipUpdate < 150 && percent < 100) return
        lastZipUpdate = now
        progress.percentage = DOWNLOAD_END + (percent / 100) * (ZIP_END - DOWNLOAD_END)
        report()
      },
    )

    progress.status = "sending"
    progress.percentage = ZIP_END
    progress.currentPaper = "Preparing download"
    report()

    await wait(300)

    progress.percentage = 98
    progress.currentPaper = "Starting download"
    report()

    saveBlob(zipBlob, formatZipFilename(uniquePapers, filters))

    progress.status = "complete"
    progress.percentage = 100
    progress.currentPaper =
      errorCount > 0
        ? `${successCount} papers downloaded • ${errorCount} failed`
        : `${successCount} papers downloaded`
    report()

    return true
  } catch (error) {
    console.error("Batch download failed:", error)

    onProgress?.({
      totalPapers: papers.length,
      completed: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      percentage: 0,
    })
    toast.error("Failed to create batch download")
    return false
  }
}
