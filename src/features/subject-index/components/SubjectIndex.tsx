"use client"

import { useState, useEffect } from "react"
import { ArrowUp } from "@phosphor-icons/react"
import { scrollContainer } from "@/components/layout/scroll-container"
import SubjectAlphabetList, { AlphabetBar } from "./SubjectAlphabetList"
import SubjectSearchBox from "./SubjectSearchBox"

interface SubjectIndexProps {
  subjects: string[]
}

export default function SubjectIndex({ subjects }: SubjectIndexProps) {
  const [showGoUp, setShowGoUp] = useState(false)

  useEffect(() => {
    const container = scrollContainer()
    if (!container) return

    const handleScroll = () => setShowGoUp(container.scrollTop > 100)

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  const handleGoUp = () => {
    scrollContainer()?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <>
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight text-content sm:text-5xl">
          Find Your Papers
        </h1>
        <p className="mt-4 text-lg text-content/70">
          Your one-stop destination for all previous year question papers.
        </p>
      </div>

      <div className="w-full bg-primary py-6 sm:py-8">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AlphabetBar subjects={subjects} />
        </div>
      </div>

      <div className="flex items-center gap-4 justify-center px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-30">
        <div className="w-full max-w-2xl">
          <SubjectSearchBox subjects={subjects} />
        </div>
        {showGoUp && (
          <button
            onClick={handleGoUp}
            aria-label="Go to top"
            className="p-2.5 rounded-full bg-secondary shadow-md transition-transform duration-200 hover:scale-105 focus:outline-none"
          >
            <ArrowUp size={20} weight="bold" className="text-content" />
          </button>
        )}
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <SubjectAlphabetList subjects={subjects} />
      </div>
    </>
  )
}
