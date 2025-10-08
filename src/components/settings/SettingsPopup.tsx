"use client"

import { useTheme } from "next-themes"
import { useSettings } from "@/contexts/SettingsContext"
import { Sun, Moon, Mouse, ComputerTower, Trash } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getCacheManager } from "@/lib/cache/manager"

export default function SettingsPopup() {
    const { theme, setTheme } = useTheme()
    const { cursorStyle, setCursorStyle, clearAllCache } = useSettings()
    const router = useRouter()
    const [isClearing, setIsClearing] = useState(false)
    const [cacheSize, setCacheSize] = useState<string>("0 B")
    const [cacheCount, setCacheCount] = useState<number>(0)

    // Load cache stats when component mounts
    useEffect(() => {
        const loadCacheStats = async () => {
            try {
                const cacheManager = getCacheManager()
                const stats = await cacheManager.getCacheStats()
                setCacheSize(cacheManager.formatBytes(stats.totalSize))
                setCacheCount(stats.totalPapers)
            } catch (error) {
                console.error("Failed to load cache stats:", error)
            }
        }
        loadCacheStats()
    }, [])

    const handleClearCache = async () => {
        setIsClearing(true)
        try {
            await clearAllCache()

            // Update cache stats after clearing
            setCacheSize("0 B")
            setCacheCount(0)
            router.push("/") // Redirect to homepage
        } catch (error) {
            toast.error("Failed to clear cache")
            console.error("Cache clear error:", error)
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <div className="absolute right-0 top-12 w-48 rounded-md border border-accent/50 bg-secondary p-2 shadow-lg">
            <div className="flex flex-col space-y-1">
                <button
                    onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="flex w-full items-center justify-between rounded-md p-2 text-sm text-content/80 transition-colors hover:bg-brand/10 hover:text-brand"
                >
                    <span>Theme</span>
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button
                    onClick={() =>
                        setCursorStyle(
                            cursorStyle === "ghost" ? "default" : "ghost"
                        )
                    }
                    className="flex w-full items-center justify-between rounded-md p-2 text-sm text-content/80 transition-colors hover:bg-brand/10 hover:text-brand"
                >
                    <span>Cursor</span>
                    {cursorStyle === "ghost" ? (
                        <Mouse size={16} />
                    ) : (
                        <ComputerTower size={16} />
                    )}
                </button>

                {/* Clear Cache Button */}
                <div className="border-t border-accent/20 pt-1">
                    <button
                        onClick={handleClearCache}
                        disabled={isClearing || cacheCount === 0}
                        className="flex w-full flex-col items-start rounded-md p-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex w-full items-center justify-between">
                            <span>{isClearing ? "Clearing..." : "Clear Cache"}</span>
                            <Trash size={16} />
                        </div>
                        <div className="text-xs text-content/60 mt-1">
                            {cacheCount > 0 ? `${cacheCount} papers • ${cacheSize}` : "No cached papers"}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    )
}
