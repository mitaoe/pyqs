"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import type { PaperFilters } from "@/features/catalog/papers"
import type { PaperSummary } from "@/features/catalog/types"
import { batchDownloadPapers } from "@/features/downloads/batch-download"
import { downloadFile } from "@/features/downloads/download-file"
import type { BatchDownloadProgress } from "@/features/downloads/types"
import { useServerStatus } from "@/features/server-status/ServerStatusProvider"

const CLOSE_AFTER_COMPLETE_MS = 1000
const CLOSE_AFTER_ERROR_MS = 3000

export function useBatchDownload(
  selectedPapers: PaperSummary[],
  filters: PaperFilters,
  onComplete: () => void,
) {
  const { isServerDown } = useServerStatus()
  const [progress, setProgress] = useState<BatchDownloadProgress | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const close = () => {
    clearCloseTimer()
    setProgress(null)
  }

  const runBatch = async () => {
    clearCloseTimer()

    setProgress({
      totalPapers: selectedPapers.length,
      completed: 0,
      status: "preparing",
      percentage: 0,
      failedCount: 0,
    })

    await batchDownloadPapers(selectedPapers, filters, (update) => {
      setProgress(update)

      if (update.status === "complete" || update.status === "error") {
        const delay = update.status === "error" ? CLOSE_AFTER_ERROR_MS : CLOSE_AFTER_COMPLETE_MS
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null
          setProgress(null)
          if (update.status === "complete") onComplete()
        }, delay)
      }
    })
  }

  const start = async () => {
    if (isServerDown) {
      toast.error("Paper storage is currently unreachable. Please try again later.")
      return
    }

    if (selectedPapers.length === 0) {
      toast.error("No papers selected for download")
      return
    }

    if (selectedPapers.length === 1) {
      const paper = selectedPapers[0]
      try {
        const toastId = toast.loading(`Downloading ${paper.fileName}...`)
        const success = await downloadFile(paper.url, paper.fileName)
        toast.dismiss(toastId)
        if (success) onComplete()
      } catch (error) {
        console.error("Download failed:", error)
        toast.error("Failed to download paper. Please try again.")
      }
      return
    }

    await runBatch()
  }

  return { progress, start, retry: runBatch, close }
}
