"use client"

import { ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
import { useIsHydrated } from "@/hooks/useIsHydrated"
import GhostCursor from "./animations/GhostCursor"

interface ClientProviderProps {
    children: ReactNode
    fallback?: ReactNode
}

function App({ children }: { children: ReactNode }) {
    const { cursorStyle } = useSettings()
    return (
        <>
            {children}
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
            <SettingsProvider>
                <App>{children}</App>
            </SettingsProvider>
        </ThemeProvider>
    )
}
