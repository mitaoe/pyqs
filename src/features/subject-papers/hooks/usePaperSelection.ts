"use client"

import { useMemo, useState } from "react"
import type { PaperSummary } from "@/features/catalog/types"

export function usePaperSelection(visiblePapers: PaperSummary[]) {
  const [selectedPapers, setSelectedPapers] = useState<Record<string, boolean>>({})
  const [isSelectMode, setIsSelectMode] = useState(false)

  const selectedCount = useMemo(
    () => Object.values(selectedPapers).filter(Boolean).length,
    [selectedPapers],
  )

  const selectedList = useMemo(
    () => visiblePapers.filter((paper) => selectedPapers[paper.fileName]),
    [visiblePapers, selectedPapers],
  )

  const [lastVisiblePapers, setLastVisiblePapers] = useState(visiblePapers)
  if (visiblePapers !== lastVisiblePapers) {
    setLastVisiblePapers(visiblePapers)

    if (isSelectMode) {
      const stillVisible: Record<string, boolean> = {}
      visiblePapers.forEach((paper) => {
        if (selectedPapers[paper.fileName]) stillVisible[paper.fileName] = true
      })
      if (Object.keys(stillVisible).length !== Object.keys(selectedPapers).length) {
        setSelectedPapers(stillVisible)
      }
    }
  }

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev)
    if (isSelectMode) setSelectedPapers({})
  }

  const togglePaper = (fileName: string) => {
    setSelectedPapers((prev) => ({ ...prev, [fileName]: !prev[fileName] }))
  }

  const allSelected = selectedCount === visiblePapers.length && visiblePapers.length > 0

  const toggleAll = () => {
    if (selectedCount === visiblePapers.length) {
      setSelectedPapers({})
    } else {
      const everything: Record<string, boolean> = {}
      visiblePapers.forEach((paper) => {
        everything[paper.fileName] = true
      })
      setSelectedPapers(everything)
    }
  }

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedPapers({})
  }

  return {
    isSelectMode,
    isSelected: (fileName: string) => Boolean(selectedPapers[fileName]),
    selectedCount,
    selectedList,
    allSelected,
    toggleSelectMode,
    togglePaper,
    toggleAll,
    exitSelectMode,
  }
}

export type PaperSelectionState = ReturnType<typeof usePaperSelection>
