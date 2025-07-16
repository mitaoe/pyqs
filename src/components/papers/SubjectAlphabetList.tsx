"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { usePapers } from "@/contexts/PaperContext"
import { motion } from "framer-motion"
import {
    groupSubjectsByLetter,
    getAvailableLetters,
} from "@/utils/subjectSearch"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

// Global state for communication between components
interface GlobalAlphabetRefs {
    current: Record<string, HTMLDivElement | null>
}

// Store refs globally for access between components
let globalSectionRefs: GlobalAlphabetRefs = {
    current: {},
}

// The component that displays just the A-Z bar
export const AlphabetBar = () => {
    const { meta } = usePapers()
    const [availableLetters, setAvailableLetters] = useState<Set<string>>(
        new Set()
    )
    const [activeSection, setActiveSection] = useState<string | null>(null)
    const [hoverLetter, setHoverLetter] = useState<string | null>(null)

    // Determine which letters have subjects
    useEffect(() => {
        if (meta?.standardSubjects?.length) {
            setAvailableLetters(getAvailableLetters(meta.standardSubjects))
        }
    }, [meta?.standardSubjects])

    const scrollToSection = (letter: string) => {
        if (globalSectionRefs.current[letter]) {
            globalSectionRefs.current[letter]?.scrollIntoView({
                behavior: "smooth",
            })
            setActiveSection(letter)
        }
    }

    return (
        <div className="w-full mx-auto max-w-6xl">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {ALPHABET.map((letter) => (
                    <button
                        key={letter}
                        onClick={() =>
                            availableLetters.has(letter) &&
                            scrollToSection(letter)
                        }
                        onMouseEnter={() => setHoverLetter(letter)}
                        onMouseLeave={() => setHoverLetter(null)}
                        className={`
              flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-out
              h-9 w-9 text-sm
              sm:h-10 sm:w-10 sm:text-base
              md:h-10 md:w-10 md:text-base
              lg:h-10 lg:w-10 lg:text-base
              ${
                  availableLetters.has(letter)
                      ? activeSection === letter
                          ? "bg-blue-600/70 text-white shadow-md ring-2 ring-blue-500/50"
                          : hoverLetter === letter
                          ? "bg-blue-500/60 text-white border border-blue-400/60 shadow-sm"
                          : "bg-blue-400/40 text-blue-900 dark:text-blue-100 hover:bg-blue-500/60 hover:text-white hover:border hover:border-blue-400/60 hover:shadow-sm"
                      : "cursor-default opacity-40 bg-secondary/30"
              }
            `}
                        disabled={!availableLetters.has(letter)}
                        aria-label={`Jump to subjects starting with letter ${letter}`}
                    >
                        {letter}
                    </button>
                ))}
            </div>
        </div>
    )
}

// Main component with subject listing
const SubjectAlphabetList = () => {
    const { meta } = usePapers()
    const router = useRouter()
    const [subjectsByLetter, setSubjectsByLetter] = useState<
        Record<string, string[]>
    >({})
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // Group subjects by their first letter
    useEffect(() => {
        if (meta?.standardSubjects?.length) {
            setSubjectsByLetter(groupSubjectsByLetter(meta.standardSubjects))
        }
    }, [meta?.standardSubjects])

    // Connect local refs to the global refs
    useEffect(() => {
        globalSectionRefs = {
            current: sectionRefs.current,
        }
    }, [])

    // Handle subject selection
    const handleSubjectClick = (subject: string) => {
        router.push(`/papers?subject=${encodeURIComponent(subject)}`)
    }

    // Ref callback for setting the section refs
    const setSectionRef = (letter: string) => (el: HTMLDivElement | null) => {
        sectionRefs.current[letter] = el
    }

    return (
        <div className="w-full max-w-6xl mx-auto">
            {/* Subject Sections */}
            <div className="space-y-20">
                {ALPHABET.map((letter) => {
                    if (!subjectsByLetter[letter]?.length) return null

                    return (
                        <motion.div
                            key={letter}
                            ref={setSectionRef(letter)}
                            className="scroll-mt-32"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="flex items-center mb-6">
                                <h2 className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-600/70 text-lg sm:text-xl font-bold text-white shadow-md">
                                    {letter}
                                </h2>
                                <div className="h-px flex-1 bg-blue-400/40 ml-4"></div>
                            </div>

                            <div className="grid gap-x-6 gap-y-4 sm:gap-x-8 sm:gap-y-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {subjectsByLetter[letter]?.map(
                                    (subject, index) => (
                                        <motion.div
                                            key={subject}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{
                                                duration: 0.3,
                                                delay: index * 0.03,
                                            }}
                                            className="group"
                                        >
                                            <div className="inline-block relative w-full">
                                                <button
                                                    onClick={() =>
                                                        handleSubjectClick(
                                                            subject
                                                        )
                                                    }
                                                    className="text-left py-2 px-2 text-content group-hover:text-content/80 transition-colors duration-200 w-full text-sm sm:text-base font-medium"
                                                >
                                                    {subject}
                                                </button>
                                                {/* Animated underline limited to text width */}
                                                <div className="absolute bottom-0 left-0 w-full h-[1px] overflow-hidden">
                                                    <div className="w-full h-full bg-content/60 transform translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}

export default SubjectAlphabetList
