"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { usePapers } from "@/contexts/PaperContext"
import { MagnifyingGlass, XCircle } from "@phosphor-icons/react"
import { searchSubjects, getHighlightedText } from "@/utils/subjectSearch"

interface SubjectSearchBoxProps {
    onSelect?: (subject: string) => void
}

const SubjectSearchBox = ({ onSelect }: SubjectSearchBoxProps) => {
    const { meta } = usePapers()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const selectedItemRef = useRef<HTMLLIElement>(null)

    // Filter subjects based on search query
    useEffect(() => {
        const filteredSubjects = searchSubjects(meta, searchQuery)
        setSuggestions(filteredSubjects)
        setSelectedIndex(-1) // Reset selection when query changes
    }, [searchQuery, meta])

    // Handle click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    // Scroll selected item into view when it changes
    useEffect(() => {
        if (selectedIndex >= 0 && selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
            })
        }
    }, [selectedIndex])

    // Handle subject selection
    const handleSelectSubject = (subject: string) => {
        setSearchQuery("")
        setShowSuggestions(false)
        setSelectedIndex(-1)

        if (onSelect) {
            onSelect(subject)
        } else {
            router.push(`/papers?subject=${encodeURIComponent(subject)}`)
        }
    }

    // Keyboard navigation for suggestions
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            if (suggestions.length > 0) {
                setSelectedIndex((prev) => (prev + 1) % suggestions.length)
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            if (suggestions.length > 0) {
                setSelectedIndex(
                    (prev) =>
                        (prev - 1 + suggestions.length) % suggestions.length
                )
            }
        } else if (e.key === "Enter") {
            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                e.preventDefault()
                handleSelectSubject(suggestions[selectedIndex])
            }
        }
    }

    // Clear the search query and blur the input (hides mobile keyboard)
    const handleClear = () => {
        setSearchQuery("")
        setShowSuggestions(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
    }

    return (
        <div className="relative w-full">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for subjects..."
                    className="w-full h-12 rounded-full border border-accent bg-secondary py-3 pl-12 pr-11 text-content placeholder:text-content/60 focus:border-content/40 focus:ring-1 focus:ring-content/40 focus:outline-none transition-all shadow-sm text-base"
                    aria-label="Search for subjects"
                />
                <MagnifyingGlass
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-content/60"
                    weight="bold"
                    size={20}
                />
                {searchQuery && (
                    <button
                        onClick={handleClear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 focus:outline-none"
                        aria-label="Clear search"
                    >
                        <XCircle size={20} weight="fill" />
                    </button>
                )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-accent bg-secondary shadow-lg"
                >
                    <ul className="py-1">
                        {suggestions.map((subject, index) => {
                            const { prefix, highlight, suffix } =
                                getHighlightedText(subject, searchQuery)
                            const isActive = index === selectedIndex
                            return (
                                <li
                                    key={subject}
                                    className={`group ${
                                        isActive ? "bg-accent/20" : ""
                                    }`}
                                    ref={isActive ? selectedItemRef : null}
                                >
                                    <button
                                        className="w-full px-4 py-2.5 text-left text-content/80 group-hover:text-content group-hover:bg-accent/20 transition-all duration-150"
                                        onClick={() =>
                                            handleSelectSubject(subject)
                                        }
                                    >
                                        {prefix}
                                        <span
                                            className="underline underline-offset-4 decoration-[0.75px] decoration-content/80 text-content inline-block"
                                            style={{
                                                transform: "skewX(-10deg)",
                                            }}
                                        >
                                            {highlight}
                                        </span>
                                        {suffix}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default SubjectSearchBox
