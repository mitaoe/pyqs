"use client"

import { Funnel, X } from "@phosphor-icons/react"
import type { PaperFiltersState } from "../hooks/usePaperFilters"

interface FilterControlProps {
  filtersState: PaperFiltersState
  buttonClassName: string
}

export default function FilterControl({ filtersState, buttonClassName }: FilterControlProps) {
  const { isAnyFilterActive, showFilters, toggleShowFilters } = filtersState

  return (
    <div className="relative">
      <button
        onClick={toggleShowFilters}
        className={`${buttonClassName} rounded-lg transition-colors ${
          isAnyFilterActive || showFilters
            ? "bg-brand text-white"
            : "bg-secondary text-content/80 hover:text-brand"
        }`}
        aria-label="Show filters"
      >
        <Funnel size={16} weight={isAnyFilterActive ? "fill" : "bold"} />
      </button>
      {showFilters && <FilterDropdown filtersState={filtersState} />}
    </div>
  )
}

function FilterDropdown({ filtersState }: { filtersState: PaperFiltersState }) {
  const { filters, options, isAnyFilterActive, closeFilters, toggleFilter, clearFilters } =
    filtersState

  return (
    <div className="absolute right-0 top-full mt-2 bg-secondary border border-accent/50 rounded-xl shadow-lg p-4 z-30 w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-content">Filters</h3>
        <button
          onClick={closeFilters}
          className="text-content/60 hover:text-brand p-1"
          aria-label="Close filters"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-xs font-medium text-content/70 mb-2">Year</h4>
        <div className="flex flex-wrap gap-2">
          {options.years.map((year) => (
            <button
              key={year}
              onClick={() => toggleFilter("years", year)}
              className={`px-2 py-1 text-xs rounded-md ${
                filters.years.includes(year)
                  ? "bg-brand text-white"
                  : "bg-secondary hover:bg-brand/10 hover:text-brand"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-xs font-medium text-content/70 mb-2">Exam Type</h4>
        <div className="flex gap-2">
          {options.examTypes.map((examType) => (
            <button
              key={examType}
              onClick={() => toggleFilter("examTypes", examType)}
              className={`px-2 py-1 text-xs rounded-md ${
                filters.examTypes.includes(examType)
                  ? "bg-brand text-white"
                  : "bg-secondary hover:bg-brand/10 hover:text-brand"
              }`}
            >
              {examType}
            </button>
          ))}
        </div>
      </div>

      {isAnyFilterActive && (
        <button
          onClick={clearFilters}
          className="w-full text-xs bg-secondary hover:bg-brand/10 hover:text-brand py-1.5 rounded-md transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )
}
