"use client"

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from "react"
import { getCacheManager } from "@/features/downloads/pdf-cache/manager"
import { removeLegacyCatalogCache } from "@/features/catalog/legacy-cache"
import { readStorage, writeStorage } from "@/lib/browser-storage"

type CursorStyle = "default" | "ghost"

const CURSOR_STYLE_KEY = "cursor-style"

function readStoredCursorStyle(): CursorStyle {
  if (typeof window === "undefined") return "ghost"
  const saved = readStorage(CURSOR_STYLE_KEY)
  return saved === "default" || saved === "ghost" ? saved : "ghost"
}

interface SettingsContextType {
  cursorStyle: CursorStyle
  setCursorStyle: (style: CursorStyle) => void
  clearAllCache: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [cursorStyle, setCursorStyleState] = useState<CursorStyle>(readStoredCursorStyle)

  const setCursorStyle = useCallback((style: CursorStyle) => {
    setCursorStyleState(style)
    writeStorage(CURSOR_STYLE_KEY, style)
  }, [])

  const clearAllCache = useCallback(async () => {
    try {
      await getCacheManager().clearAllCache()
      removeLegacyCatalogCache()
    } catch (error) {
      console.error("Failed to clear cache:", error)
      throw error
    }
  }, [])

  const value = useMemo(
    () => ({ cursorStyle, setCursorStyle, clearAllCache }),
    [cursorStyle, setCursorStyle, clearAllCache],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
