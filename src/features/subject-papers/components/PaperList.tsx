"use client"

import { CheckSquare, Download, Eye, FileText, Square } from "@phosphor-icons/react"
import FadeIn from "@/components/animations/FadeIn"
import type { PaperCollectionProps } from "./paper-collection"

export default function PaperList({
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
    <div data-papers-list="" className="space-y-3 sm:space-y-4">
      {papers.map((paper, index) => (
        <FadeIn
          key={`${paper.fileName}-${index}`}
          delay={Math.min(index * 0.03, 0.2)}
          duration={0.4}
        >
          <div
            data-paper-file={paper.fileName}
            className={`flex items-center justify-between bg-secondary border-2 rounded-xl p-3 sm:p-4 transition-all duration-300 hover:shadow-md ${
              isSelected(paper.fileName)
                ? "border-brand shadow-sm shadow-brand/20"
                : "border-accent/30 hover:border-accent/50"
            } ${isSelectMode ? "cursor-pointer" : ""}`}
            onClick={isSelectMode ? () => onToggleSelected(paper.fileName) : undefined}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-3 sm:gap-4 max-w-[70%]">
              {isSelectMode ? (
                <div
                  className={`w-5 h-5 flex-shrink-0 rounded flex items-center justify-center transition-colors duration-200 ${
                    isSelected(paper.fileName)
                      ? "bg-brand text-white"
                      : "bg-primary/40 text-content/80"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelected(paper.fileName)
                  }}
                >
                  {isSelected(paper.fileName) ? (
                    <CheckSquare size={14} weight="fill" />
                  ) : (
                    <Square size={14} weight="regular" />
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/60 flex-shrink-0">
                  <FileText size={20} weight="duotone" className="text-content/80" />
                </div>
              )}
              <div className="flex flex-col overflow-hidden min-w-0">
                <div className="flex flex-wrap gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-accent/20 rounded-md text-xs font-medium whitespace-nowrap">
                    {paper.year}
                  </span>
                  <span className="px-2 py-0.5 bg-primary/60 rounded-md text-xs font-medium whitespace-nowrap">
                    {paper.examType}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-content truncate">
                  {paper.fileName}
                </h3>
              </div>
            </div>
            {!isSelectMode ? (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreview(paper)
                  }}
                  disabled={isServerDown}
                  className="flex items-center gap-2 bg-accent/20 text-content rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye size={16} weight="duotone" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownload(paper)
                  }}
                  disabled={isDownloading(paper) || isServerDown}
                  className="flex items-center gap-2 bg-brand text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download
                    size={16}
                    weight="duotone"
                    className={isDownloading(paper) ? "animate-spin" : ""}
                  />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>
            ) : null}
          </div>
        </FadeIn>
      ))}
    </div>
  )
}
