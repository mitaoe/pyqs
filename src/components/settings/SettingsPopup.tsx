"use client"

import { useTheme } from "next-themes"
import { useSettings } from "@/contexts/SettingsContext"
import { Sun, Moon, Mouse, ComputerTower } from "@phosphor-icons/react"

export default function SettingsPopup() {
    const { theme, setTheme } = useTheme()
    const { cursorStyle, setCursorStyle } = useSettings()

    return (
        <div className="absolute right-0 top-12 w-48 rounded-md border border-blue-400/30 bg-primary p-2 shadow-lg">
            <div className="flex flex-col space-y-2">
                <button
                    onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="flex w-full items-center justify-between rounded-md p-2 text-sm text-blue-900 dark:text-blue-100 hover:bg-blue-500/60 hover:text-white transition-colors"
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
                    className="flex w-full items-center justify-between rounded-md p-2 text-sm text-blue-900 dark:text-blue-100 hover:bg-blue-500/60 hover:text-white transition-colors"
                >
                    <span>Cursor</span>
                    {cursorStyle === "ghost" ? (
                        <Mouse size={16} />
                    ) : (
                        <ComputerTower size={16} />
                    )}
                </button>
            </div>
        </div>
    )
}
