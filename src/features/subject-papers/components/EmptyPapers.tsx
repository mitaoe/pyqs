"use client"

import Image from "next/image"
import type { PaperFiltersState } from "../hooks/usePaperFilters"
import BackToSubjectsButton from "./BackToSubjectsButton"
import FilterControl from "./FilterControl"

interface EmptyPapersProps {
  subject: string
  filtersState: PaperFiltersState
}

export default function EmptyPapers({ subject, filtersState }: EmptyPapersProps) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
      <div className="sticky top-0 z-20 bg-primary/80 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-4 rounded-xl flex flex-col mb-6 sm:mb-8 shadow-sm border border-accent/50">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-3 sm:gap-4 max-w-[80%] sm:max-w-[60%]">
            <BackToSubjectsButton />
            <h2 className="text-lg sm:text-2xl font-bold text-content truncate">{subject}</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <FilterControl filtersState={filtersState} buttonClassName="p-2 sm:p-2.5" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xs sm:text-sm text-content/80">0 papers</span>
          </div>

          <div className="flex sm:hidden items-center gap-2">
            <FilterControl filtersState={filtersState} buttonClassName="p-2" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center mt-8 sm:mt-12">
        <Image
          src="/images/not-found.png"
          alt="No papers found"
          width={256}
          height={256}
          className="w-48 sm:w-64 h-auto mb-6"
        />
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-center">No papers found</h3>
        <p className="text-content/60 mb-4 text-sm sm:text-base text-center max-w-md">
          {filtersState.isAnyFilterActive
            ? "No papers match the current filters."
            : `We couldn't find any papers for ${subject || "this subject"}. Please try another subject.`}
        </p>
      </div>
    </div>
  )
}
