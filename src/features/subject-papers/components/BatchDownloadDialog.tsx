"use client"

import { X } from "@phosphor-icons/react"
import type { BatchDownloadProgress } from "@/features/downloads/types"
import BatchProgressBar from "./BatchProgressBar"

interface BatchDownloadDialogProps {
  progress: BatchDownloadProgress
  onClose: () => void
  onRetry: () => void
}

export default function BatchDownloadDialog({
  progress,
  onClose,
  onRetry,
}: BatchDownloadDialogProps) {
  const isFinished = progress.status === "complete" || progress.status === "error"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-secondary rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-primary/20">
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-content mb-1 truncate">
              {progress.status === "complete"
                ? "Download Complete"
                : progress.status === "error"
                  ? "Download Failed"
                  : "Batch Download"}
            </h3>
            <p className="text-xs sm:text-sm text-content/60">
              {progress.totalPapers} papers selected
              {progress.failedCount ? ` • ${progress.failedCount} failed` : ""}
            </p>
          </div>
          {isFinished && (
            <button
              onClick={onClose}
              className="text-content/60 hover:text-content transition-colors p-1 ml-2 flex-shrink-0"
              aria-label="Close"
            >
              <X size={20} weight="bold" className="sm:w-6 sm:h-6" />
            </button>
          )}
        </div>

        <BatchProgressBar progress={progress} />

        {progress.status === "error" && (
          <div className="mt-4 text-center">
            <p className="text-red-500 mb-4 text-sm">{progress.error}</p>
            <button
              onClick={onRetry}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
