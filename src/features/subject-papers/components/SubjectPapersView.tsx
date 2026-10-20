"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "motion/react"
import { toast } from "sonner"
import FadeIn from "@/components/animations/FadeIn"
import { scrollToTop } from "@/components/layout/scroll-container"
import type { PaperSummary } from "@/features/catalog/types"
import PDFViewer from "@/features/pdf-viewer/PDFViewer"
import { useServerStatus } from "@/features/server-status/ServerStatusProvider"
import { useBatchDownload } from "../hooks/useBatchDownload"
import { useEntranceDelay } from "../hooks/useEntranceDelay"
import { usePaperDownload } from "../hooks/usePaperDownload"
import { usePaperFilters } from "../hooks/usePaperFilters"
import { usePaperSelection } from "../hooks/usePaperSelection"
import { usePublicSubjectUrl } from "../hooks/usePublicSubjectUrl"
import { useSelectTutorial } from "../hooks/useSelectTutorial"
import { useViewMode } from "../hooks/useViewMode"
import BatchDownloadButton from "./BatchDownloadButton"
import BatchDownloadDialog from "./BatchDownloadDialog"
import EmptyPapers from "./EmptyPapers"
import PaperGrid from "./PaperGrid"
import PaperList from "./PaperList"
import PapersLoading from "./PapersLoading"
import PapersToolbar from "./PapersToolbar"

const ENTRANCE_DELAY_MS = 300
const UNKNOWN_SUBJECT_REDIRECT_MS = 1500

interface SubjectPapersViewProps {
  subject: string
  papers: PaperSummary[]
  isKnownSubject: boolean
}

export default function SubjectPapersView({
  subject,
  papers,
  isKnownSubject,
}: SubjectPapersViewProps) {
  const router = useRouter()
  const { isServerDown, recordFailure } = useServerStatus()
  const isEntering = useEntranceDelay(ENTRANCE_DELAY_MS)
  const { viewMode, setViewMode, toggleViewMode } = useViewMode()
  const { showTutorial, dismissTutorial } = useSelectTutorial()
  const filtersState = usePaperFilters(papers)
  const { filteredPapers, filters } = filtersState
  const selection = usePaperSelection(filteredPapers)
  const { download, isDownloading } = usePaperDownload()
  const batch = useBatchDownload(selection.selectedList, filters, selection.exitSelectMode)
  const [previewPaper, setPreviewPaper] = useState<PaperSummary | null>(null)

  usePublicSubjectUrl(subject)

  useEffect(() => {
    scrollToTop()
  }, [])

  useEffect(() => {
    if (isKnownSubject) return

    toast.error(`Subject "${subject}" not found`, {
      description: "Redirecting to the subject list",
      duration: 4000,
    })
    const timer = setTimeout(() => router.push("/papers"), UNKNOWN_SUBJECT_REDIRECT_MS)
    return () => clearTimeout(timer)
  }, [isKnownSubject, subject, router])

  if (isEntering) {
    return <PapersLoading />
  }

  if (!filteredPapers.length) {
    return <EmptyPapers subject={subject} filtersState={filtersState} />
  }

  const previewIndex = previewPaper
    ? filteredPapers.findIndex((paper) => paper.url === previewPaper.url)
    : -1
  const hasPreviousPaper = previewIndex > 0
  const hasNextPaper = previewIndex >= 0 && previewIndex < filteredPapers.length - 1

  const openPreview = (paper: PaperSummary) => {
    if (isServerDown) {
      toast.error("Paper storage is currently unreachable. Preview is unavailable.")
      return
    }
    setPreviewPaper(paper)
  }

  const collectionProps = {
    papers: filteredPapers,
    isSelectMode: selection.isSelectMode,
    isSelected: selection.isSelected,
    onToggleSelected: selection.togglePaper,
    onPreview: openPreview,
    onDownload: download,
    isDownloading,
    isServerDown,
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
      <PapersToolbar
        subject={subject}
        paperCount={filteredPapers.length}
        filtersState={filtersState}
        selection={selection}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleViewMode={toggleViewMode}
        showTutorial={showTutorial}
        onDismissTutorial={dismissTutorial}
      />

      <FadeIn>
        {viewMode === "grid" ? (
          <PaperGrid {...collectionProps} />
        ) : (
          <PaperList {...collectionProps} />
        )}
      </FadeIn>

      {selection.isSelectMode && selection.selectedCount > 0 && (
        <BatchDownloadButton
          selectedCount={selection.selectedCount}
          disabled={isServerDown}
          onClick={batch.start}
        />
      )}

      {batch.progress && (
        <BatchDownloadDialog
          progress={batch.progress}
          onClose={batch.close}
          onRetry={batch.retry}
        />
      )}

      <AnimatePresence>
        {previewPaper && (
          <PDFViewer
            key="pdf-viewer"
            paper={previewPaper}
            onClose={() => setPreviewPaper(null)}
            onFailure={recordFailure}
            onPrev={
              hasPreviousPaper ? () => setPreviewPaper(filteredPapers[previewIndex - 1]) : undefined
            }
            onNext={
              hasNextPaper ? () => setPreviewPaper(filteredPapers[previewIndex + 1]) : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  )
}
