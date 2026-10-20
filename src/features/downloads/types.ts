import type { Paper } from "@/types/paper"

export type DownloadablePaper = Pick<
  Paper,
  "url" | "fileName" | "subject" | "standardSubject" | "year"
>

export interface BatchDownloadProgress {
  totalPapers: number
  completed: number
  status: "preparing" | "downloading" | "processing" | "sending" | "complete" | "error"
  currentPaper?: string
  error?: string
  percentage?: number
  failedCount?: number
}

export type ProgressCallback = (progress: BatchDownloadProgress) => void
