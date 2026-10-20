"use client"

import { useEffect, useState } from "react"
import { readStorage, writeStorage } from "@/lib/browser-storage"

const TUTORIAL_SEEN_KEY = "papers_select_tutorial_seen"
const SHOW_AFTER_MS = 1500

export function useSelectTutorial() {
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (readStorage(TUTORIAL_SEEN_KEY)) return
    const timer = setTimeout(() => setShowTutorial(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  const dismissTutorial = () => {
    setShowTutorial(false)
    writeStorage(TUTORIAL_SEEN_KEY, "true")
  }

  return { showTutorial, dismissTutorial }
}
