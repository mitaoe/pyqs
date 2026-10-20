"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { CheckCircle, XCircle } from "@phosphor-icons/react"
import type { BatchDownloadProgress } from "@/features/downloads/types"

interface BatchProgressBarProps {
  progress: BatchDownloadProgress
}

export default function BatchProgressBar({ progress }: BatchProgressBarProps) {
  const percentage = progress.percentage ?? 0
  const value = useMotionValue(percentage)
  const scaleX = useTransform(value, [0, 100], [0, 1])
  const percentLabel = useTransform(value, (v) => `${Math.round(v)}%`)
  const statusText =
    progress.status === "error"
      ? progress.error || "Download failed"
      : progress.currentPaper || "Processing..."

  useEffect(() => {
    const current = value.get()
    if (percentage < current) {
      value.jump(percentage)
      return
    }

    const controls = animate(value, percentage, {
      duration: Math.min(0.8, Math.max(0.25, (percentage - current) / 60)),
      ease: "easeOut",
    })
    return () => controls.stop()
  }, [percentage, value])

  return (
    <div className="mb-4">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
        aria-valuetext={statusText}
        aria-label="Batch download progress"
        className="h-2.5 overflow-hidden rounded-full bg-primary/20"
      >
        <motion.div className="h-full origin-left rounded-full bg-brand" style={{ scaleX }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs sm:text-sm text-content/80">
          {statusText}
        </span>
        <div className="flex flex-shrink-0 items-center gap-2">
          {progress.status === "complete" && (
            <CheckCircle size={18} weight="fill" className="text-emerald-500" />
          )}
          {progress.status === "error" && (
            <XCircle size={18} weight="fill" className="text-red-500" />
          )}
          <motion.span className="text-xs sm:text-sm font-mono font-bold text-content">
            {percentLabel}
          </motion.span>
        </div>
      </div>
    </div>
  )
}
