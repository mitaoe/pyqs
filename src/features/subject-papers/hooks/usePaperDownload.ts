"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import type { PaperSummary } from "@/features/catalog/types"
import { downloadFile } from "@/features/downloads/download-file"
import { useServerStatus } from "@/features/server-status/ServerStatusProvider"

export function usePaperDownload() {
  const { isServerDown, recordFailure } = useServerStatus()
  const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set())
  const activeDownloadsRef = useRef<Set<string>>(new Set())

  const download = async (paper: PaperSummary) => {
    if (isServerDown) {
      toast.error("Paper storage is currently unreachable. Please try again later.")
      return
    }

    if (activeDownloadsRef.current.has(paper.url)) return

    activeDownloadsRef.current.add(paper.url)
    setActiveDownloads(new Set(activeDownloadsRef.current))

    try {
      const success = await downloadFile(paper.url, paper.fileName, paper)
      if (!success) recordFailure()
    } catch (error) {
      console.error("Download failed:", error)
      recordFailure()
    } finally {
      activeDownloadsRef.current.delete(paper.url)
      setActiveDownloads(new Set(activeDownloadsRef.current))
    }
  }

  return {
    download,
    isDownloading: (paper: PaperSummary) => activeDownloads.has(paper.url),
  }
}
