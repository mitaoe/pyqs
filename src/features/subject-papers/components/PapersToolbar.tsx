"use client"

import { CheckSquare, GridFour, List, Square } from "@phosphor-icons/react"
import type { PaperFiltersState } from "../hooks/usePaperFilters"
import type { PaperSelectionState } from "../hooks/usePaperSelection"
import type { ViewMode } from "../hooks/useViewMode"
import BackToSubjectsButton from "./BackToSubjectsButton"
import FilterControl from "./FilterControl"
import SelectModeControl, {
  DESKTOP_TUTORIAL_POSITION,
  MOBILE_TUTORIAL_POSITION,
} from "./SelectModeControl"

interface PapersToolbarProps {
  subject: string
  paperCount: number
  filtersState: PaperFiltersState
  selection: PaperSelectionState
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onToggleViewMode: () => void
  showTutorial: boolean
  onDismissTutorial: () => void
}

export default function PapersToolbar({
  subject,
  paperCount,
  filtersState,
  selection,
  viewMode,
  onViewModeChange,
  onToggleViewMode,
  showTutorial,
  onDismissTutorial,
}: PapersToolbarProps) {
  const { isSelectMode, selectedCount, allSelected, toggleSelectMode, toggleAll } = selection

  return (
    <div className="sticky top-0 z-20 bg-primary/80 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-4 rounded-xl flex flex-col mb-6 sm:mb-8 shadow-sm border border-accent/50">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-3 sm:gap-4 max-w-[80%] sm:max-w-[60%]">
          <BackToSubjectsButton />
          <h2 className="text-lg sm:text-2xl font-bold text-content truncate">{subject}</h2>

          {isSelectMode && selectedCount > 0 && (
            <span className="ml-2 text-xs bg-brand text-white font-medium rounded-full px-2.5 py-1 shadow-sm">
              {selectedCount}
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 sm:gap-3 relative">
          <SelectModeControl
            isSelectMode={isSelectMode}
            onToggle={toggleSelectMode}
            buttonClassName="p-2 sm:p-2.5"
            showTutorial={showTutorial}
            onDismissTutorial={onDismissTutorial}
            tutorialPosition={DESKTOP_TUTORIAL_POSITION}
          />
          <FilterControl filtersState={filtersState} buttonClassName="p-2 sm:p-2.5" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {isSelectMode ? (
            <button
              onClick={toggleAll}
              className="text-sm text-content/80 hover:text-brand flex items-center gap-1.5 py-1"
            >
              {allSelected ? (
                <>
                  <Square size={15} weight="bold" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <CheckSquare size={15} weight="bold" />
                  <span>Select All</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-xs sm:text-sm text-content/80">{paperCount} papers</span>
          )}
        </div>

        <div className="flex sm:hidden items-center gap-2 relative">
          <SelectModeControl
            isSelectMode={isSelectMode}
            onToggle={toggleSelectMode}
            buttonClassName="p-2"
            showTutorial={showTutorial}
            onDismissTutorial={onDismissTutorial}
            tutorialPosition={MOBILE_TUTORIAL_POSITION}
          />
          <FilterControl filtersState={filtersState} buttonClassName="p-2" />

          <button
            onClick={onToggleViewMode}
            className="p-2 rounded-lg bg-secondary text-content/80 transition-colors hover:text-brand"
            aria-label="Toggle view mode"
          >
            {viewMode === "grid" ? (
              <List size={16} weight="bold" />
            ) : (
              <GridFour size={16} weight="bold" />
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center p-1 bg-secondary rounded-lg space-x-1">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "grid" ? "bg-brand text-white" : "text-content/80 hover:text-brand"
            }`}
            aria-label="Grid view"
          >
            <GridFour size={18} weight={viewMode === "grid" ? "fill" : "regular"} />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "list" ? "bg-brand text-white" : "text-content/80 hover:text-brand"
            }`}
            aria-label="List view"
          >
            <List size={18} weight={viewMode === "list" ? "fill" : "regular"} />
          </button>
        </div>
      </div>
    </div>
  )
}
