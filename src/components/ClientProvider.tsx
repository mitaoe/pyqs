"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MotionConfig } from "framer-motion"
import { ThemeProvider } from "next-themes"
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
import { AskAiProvider, useAskAi } from "@/contexts/AskAiContext"
import { useIsHydrated } from "@/hooks/useIsHydrated"
import GhostCursor from "./animations/GhostCursor"
import AskAiPanel from "./assistant/AskAiPanel"
import AskAiFab from "./assistant/AskAiFab"
import CitationThreads from "./assistant/CitationThreads"

interface ClientProviderProps {
    children: ReactNode
    fallback?: ReactNode
}

function App({ children }: { children: ReactNode }) {
    const { cursorStyle } = useSettings()
    const { isOpen, panelWidth, isDesktop, available } = useAskAi()
    const pathname = usePathname()
    // Hidden on /assistant (that page IS the assistant) and whenever the RAG
    // backend is absent/down — a graceful vanish, not a dead panel.
    const showAssistant = pathname !== "/assistant" && available
    // Desktop: push content left by the panel's width so it splits the
    // viewport. Mobile: the panel is a bottom sheet — no push.
    const pushed = showAssistant && isOpen && isDesktop
    return (
        <>
            <div
                className="transition-[margin] duration-300 ease-out"
                style={{ marginRight: pushed ? panelWidth : 0 }}
            >
                {children}
            </div>
            {showAssistant && (
                <>
                    <AskAiPanel />
                    <AskAiFab />
                    <CitationThreads />
                </>
            )}
            {cursorStyle === "ghost" && <GhostCursor />}
        </>
    )
}

export default function ClientProvider({
    children,
    fallback = null,
}: ClientProviderProps) {
    const isHydrated = useIsHydrated()

    if (!isHydrated) {
        return <>{fallback}</>
    }

    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            {/* Honour prefers-reduced-motion for the panel/collapse/FAB slides. */}
            <MotionConfig reducedMotion="user">
                <SettingsProvider>
                    <AskAiProvider>
                        <App>{children}</App>
                    </AskAiProvider>
                </SettingsProvider>
            </MotionConfig>
        </ThemeProvider>
    )
}
