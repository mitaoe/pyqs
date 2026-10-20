"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  X,
  Download,
  ArrowSquareOut,
  SpinnerGap,
  ArrowLeft,
  ArrowRight,
} from "@phosphor-icons/react"
import type { PaperSummary } from "@/features/catalog/types"
import { downloadFile } from "@/features/downloads/download-file"
import { motion } from "motion/react"

interface PDFViewerProps {
  paper: PaperSummary
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  onFailure?: () => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])'

const LOAD_TIMEOUT_MS = 20000

export default function PDFViewer({ paper, onClose, onPrev, onNext, onFailure }: PDFViewerProps) {
  const [downloading, setDownloading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(paper.url)}`

  const [lastViewerUrl, setLastViewerUrl] = useState(viewerUrl)
  if (viewerUrl !== lastViewerUrl) {
    setLastViewerUrl(viewerUrl)
    setLoaded(false)
    setFailed(false)
    setAttempt(0)
  }

  const isLoading = !loaded && !failed

  useEffect(() => {
    if (loaded || failed) return

    const timer = setTimeout(() => {
      setFailed(true)
      onFailure?.()
    }, LOAD_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [viewerUrl, attempt, loaded, failed, onFailure])

  const handleRetry = useCallback(() => {
    setLoaded(false)
    setFailed(false)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
      trigger?.focus?.()
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus()
    }
  }, [paper.url])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const handleDownload = useCallback(async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const succeeded = await downloadFile(paper.url, paper.fileName, paper)
      if (!succeeded) {
        onFailure?.()
      }
    } finally {
      setDownloading(false)
    }
  }, [paper, downloading, onFailure])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        ref={dialogRef}
        data-pdf-modal="true"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${paper.fileName}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative z-10 w-screen h-dvh bg-secondary flex flex-col overflow-hidden focus:outline-none"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-accent/30 bg-primary/60 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 bg-accent/20 rounded-md text-xs font-medium">
                {paper.year}
              </span>
              <span className="px-2 py-0.5 bg-primary/60 rounded-md text-xs font-medium">
                {paper.examType}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-content truncate">
              {paper.fileName}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-2 text-content/70 hover:text-content hover:bg-accent/20 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                aria-label="Previous PDF"
              >
                <ArrowLeft size={18} weight="bold" />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="p-2 text-content/70 hover:text-content hover:bg-accent/20 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                aria-label="Next PDF"
              >
                <ArrowRight size={18} weight="bold" />
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              aria-label={downloading ? "Downloading paper" : "Download paper"}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-brand/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <SpinnerGap size={16} className="animate-spin" />
              ) : (
                <Download size={16} weight="bold" />
              )}
              <span className="hidden sm:inline">
                {downloading ? "Downloading..." : "Download"}
              </span>
            </button>

            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open paper in a new tab"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-content rounded-lg text-sm font-medium transition-all duration-200 hover:bg-accent/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <ArrowSquareOut size={16} weight="bold" />
              <span className="hidden sm:inline">New Tab</span>
            </a>

            <button
              onClick={onClose}
              className="p-2 text-content/70 hover:text-content hover:bg-accent/20 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Close preview"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </header>

        <div className="flex-1 relative bg-neutral-900">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-neutral-900">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-accent/20 border-t-brand rounded-full animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-content/80 text-sm font-medium">Loading PDF...</p>
                <p className="text-content/50 text-xs mt-1">This may take a moment</p>
              </div>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-neutral-900 px-6 text-center">
              <p className="text-content/80 text-sm font-medium">This paper could not be loaded</p>
              <p className="text-content/50 text-xs max-w-sm">
                The paper storage may be unreachable right now.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  Try again
                </button>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-accent/20 text-content rounded-lg text-sm font-medium transition-all duration-200 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  Open in new tab
                </a>
              </div>
            </div>
          )}

          <iframe
            key={`${viewerUrl}#${attempt}`}
            src={viewerUrl}
            title={paper.fileName}
            className="w-full h-full border-0"
            onLoad={() => setLoaded(true)}
            allow="fullscreen"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
