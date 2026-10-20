"use client"

import { CheckSquare, Download, Eye, Square } from "@phosphor-icons/react"
import FadeIn from "@/components/animations/FadeIn"
import type { PaperSummary } from "@/features/catalog/types"
import type { PaperCollectionProps } from "./paper-collection"

export default function PaperGrid({
  papers,
  isSelectMode,
  isSelected,
  onToggleSelected,
  onPreview,
  onDownload,
  isDownloading,
  isServerDown,
}: PaperCollectionProps) {
  return (
    <div
      data-papers-list=""
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8"
    >
      {papers.map((paper: PaperSummary, index) => (
        <FadeIn
          key={`${paper.fileName}-${index}`}
          delay={Math.min(index * 0.05, 0.3)}
          duration={0.5}
        >
          <div
            data-paper-file={paper.fileName}
            className={`bg-secondary border-2 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg h-full ${
              isSelected(paper.fileName)
                ? "border-brand shadow-md shadow-brand/20"
                : "border-accent/30 hover:border-accent/50"
            } ${isSelectMode ? "cursor-pointer" : ""}`}
            onClick={isSelectMode ? () => onToggleSelected(paper.fileName) : undefined}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-accent/20 rounded-md text-xs font-medium">
                    {paper.year}
                  </span>
                  <span className="px-2 py-1 bg-primary/60 rounded-md text-xs font-medium">
                    {paper.examType}
                  </span>
                </div>
                {isSelectMode && (
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors duration-200 ${
                      isSelected(paper.fileName)
                        ? "bg-blue-600 text-white"
                        : "bg-primary/40 text-content/80"
                    }`}
                  >
                    {isSelected(paper.fileName) ? (
                      <CheckSquare size={14} weight="fill" />
                    ) : (
                      <Square size={14} weight="regular" />
                    )}
                  </div>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-medium text-content mb-2 line-clamp-2 leading-tight">
                {paper.fileName}
              </h3>
            </div>
            {!isSelectMode ? (
              <div className="mt-auto flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreview(paper)
                  }}
                  disabled={isServerDown}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent/20 text-content rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye size={16} weight="duotone" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownload(paper)
                  }}
                  disabled={isDownloading(paper) || isServerDown}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download
                    size={16}
                    weight="duotone"
                    className={isDownloading(paper) ? "animate-spin" : ""}
                  />
                  <span>Download</span>
                </button>
              </div>
            ) : null}
          </div>
        </FadeIn>
      ))}
    </div>
  )
}
