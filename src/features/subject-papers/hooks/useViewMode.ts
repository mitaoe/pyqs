"use client"

import { useEffect, useState } from "react"

export type ViewMode = "grid" | "list"

const MOBILE_BREAKPOINT_PX = 640

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  useEffect(() => {
    let lastWidth = 0
    const checkScreenSize = () => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      setViewMode(window.innerWidth < MOBILE_BREAKPOINT_PX ? "list" : "grid")
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  return {
    viewMode,
    setViewMode,
    toggleViewMode: () => setViewMode((prev) => (prev === "grid" ? "list" : "grid")),
  }
}
