"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { MagnifyingGlass, XCircle } from "@phosphor-icons/react"
import { searchSubjects, getHighlightedText } from "@/features/catalog/subjects"
import { useSubjectNavigation } from "../useSubjectNavigation"

interface SubjectSearchBoxProps {
  subjects: string[]
}

export default function SubjectSearchBox({ subjects }: SubjectSearchBoxProps) {
  const { openSubject, prefetchSubject, prefetchHandlers } = useSubjectNavigation()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLLIElement>(null)

  const suggestions = useMemo(() => searchSubjects(subjects, searchQuery), [subjects, searchQuery])

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

  useEffect(() => {
    if (selectedIndex >= 0 && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [selectedIndex])

  const handleSelectSubject = (subject: string) => {
    setSearchQuery("")
    setShowSuggestions(false)
    setSelectedIndex(-1)
    openSubject(subject)
  }

  const highlight = (index: number) => {
    setSelectedIndex(index)
    prefetchSubject(suggestions[index])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (suggestions.length > 0) {
        highlight((selectedIndex + 1) % suggestions.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (suggestions.length > 0) {
        highlight((selectedIndex - 1 + suggestions.length) % suggestions.length)
      }
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault()
        handleSelectSubject(suggestions[selectedIndex])
      }
    }
  }

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
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSelectedIndex(-1)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search for subjects..."
          className="w-full h-13 rounded-full border border-accent bg-secondary py-3 pl-12 pr-11 text-content placeholder:text-content/60 focus:border-content/40 focus:ring-1 focus:ring-content/40 focus:outline-none transition-all shadow-sm text-lg"
          aria-label="Search for subjects"
        />
        <MagnifyingGlass
          className="absolute left-4 top-1/2 -translate-y-1/2 text-content/60"
          weight="bold"
          size={22}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 focus:outline-none"
            aria-label="Clear search"
          >
            <XCircle size={22} weight="fill" />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-accent bg-secondary shadow-lg"
        >
          <ul className="py-1">
            {suggestions.map((subject, index) => {
              const { prefix, highlight, suffix } = getHighlightedText(subject, searchQuery)
              const isActive = index === selectedIndex
              return (
                <li
                  key={subject}
                  className={`group ${isActive ? "bg-accent/20" : ""}`}
                  ref={isActive ? selectedItemRef : null}
                >
                  <button
                    className="w-full px-4 py-2.5 text-left text-content/80 group-hover:text-content group-hover:bg-accent/20 transition-all duration-150"
                    onClick={() => handleSelectSubject(subject)}
                    {...prefetchHandlers(subject)}
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
