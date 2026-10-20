"use client"

import { FileText } from "@phosphor-icons/react"

export default function PapersLoading() {
  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="flex flex-col items-center justify-center h-[50vh] sm:h-[60vh]">
        <div className="animate-pulse w-16 h-16 sm:w-20 sm:h-20 bg-accent/20 rounded-full flex items-center justify-center mb-4">
          <FileText size={28} weight="duotone" className="text-accent/40" />
        </div>
        <p className="text-content/60 text-base sm:text-lg">Loading papers...</p>
      </div>
    </div>
  )
}
