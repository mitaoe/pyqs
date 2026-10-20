import type { PaperSummary } from "@/features/catalog/types"

export interface PaperCollectionProps {
  papers: PaperSummary[]
  isSelectMode: boolean
  isSelected: (fileName: string) => boolean
  onToggleSelected: (fileName: string) => void
  onPreview: (paper: PaperSummary) => void
  onDownload: (paper: PaperSummary) => void
  isDownloading: (paper: PaperSummary) => boolean
  isServerDown: boolean
}
