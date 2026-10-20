"use client"

import { Download, FileZip } from "@phosphor-icons/react"

interface BatchDownloadButtonProps {
  selectedCount: number
  disabled: boolean
  onClick: () => void
}

export default function BatchDownloadButton({
  selectedCount,
  disabled,
  onClick,
}: BatchDownloadButtonProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <button
        onClick={onClick}
        disabled={disabled}
        className="bg-brand text-white px-4 py-3 sm:px-6 sm:py-3.5 rounded-xl shadow-xl backdrop-blur-sm transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 flex items-center gap-2 border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selectedCount === 1 ? (
          <Download size={20} weight="duotone" />
        ) : (
          <FileZip size={20} weight="duotone" />
        )}
        <span>
          Download {selectedCount} {selectedCount === 1 ? "Paper" : "Papers"}
        </span>
      </button>
    </div>
  )
}
