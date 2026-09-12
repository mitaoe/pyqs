"use client"

import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useMemo,
    useCallback,
} from "react"
import { getCacheManager } from "@/lib/cache/manager"

type CursorStyle = "default" | "ghost"

const CURSOR_STYLE_KEY = "cursor-style"

function readStoredCursorStyle(): CursorStyle {
    try {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(CURSOR_STYLE_KEY)
            if (saved === "default" || saved === "ghost") {
                return saved
            }
        }
    } catch (error) {
        console.warn("Failed to load cursor style from localStorage:", error)
    }
    return "ghost"
}

interface SettingsContextType {
    cursorStyle: CursorStyle
    setCursorStyle: (style: CursorStyle) => void
    clearAllCache: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(
    undefined
)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [cursorStyle, setCursorStyleState] =
        useState<CursorStyle>(readStoredCursorStyle)

    // Save cursor style to localStorage whenever it changes
    const setCursorStyle = useCallback((style: CursorStyle) => {
        setCursorStyleState(style)
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem(CURSOR_STYLE_KEY, style)
            }
        } catch (error) {
            console.warn("Failed to save cursor style to localStorage:", error)
        }
    }, [])

    // Clear all cache function
    const clearAllCache = useCallback(async () => {
        try {
            // Clear PDF cache from IndexedDB
            const cacheManager = getCacheManager()
            await cacheManager.clearAllCache()
            
            // Clear papers metadata from localStorage
            localStorage.removeItem('pyq_papers_data')
        } catch (error) {
            console.error("Failed to clear cache:", error)
            throw error
        }
    }, [])

    const value = useMemo(
        () => ({
            cursorStyle,
            setCursorStyle,
            clearAllCache,
        }),
        [cursorStyle, setCursorStyle, clearAllCache]
    )

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider")
    }
    return context
}
