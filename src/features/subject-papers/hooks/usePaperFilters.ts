"use client"

import { useMemo, useState } from "react"
import {
  EMPTY_FILTERS,
  EXAM_TYPE_OPTIONS,
  filterPapers,
  hasActiveFilters,
  toggleFilterValue,
  yearOptions,
  type PaperFilters,
} from "@/features/catalog/papers"
import type { PaperSummary } from "@/features/catalog/types"

export interface FilterOptions {
  years: string[]
  examTypes: string[]
}

export function usePaperFilters(papers: PaperSummary[]) {
  const [filters, setFilters] = useState<PaperFilters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const filteredPapers = useMemo(() => filterPapers(papers, filters), [papers, filters])

  const options = useMemo<FilterOptions>(
    () => ({ years: yearOptions(papers), examTypes: [...EXAM_TYPE_OPTIONS] }),
    [papers],
  )

  return {
    filters,
    filteredPapers,
    options,
    isAnyFilterActive: hasActiveFilters(filters),
    showFilters,
    toggleShowFilters: () => setShowFilters((prev) => !prev),
    closeFilters: () => setShowFilters(false),
    toggleFilter: (key: keyof PaperFilters, value: string) =>
      setFilters((prev) => toggleFilterValue(prev, key, value)),
    clearFilters: () => setFilters(EMPTY_FILTERS),
  }
}

export type PaperFiltersState = ReturnType<typeof usePaperFilters>
