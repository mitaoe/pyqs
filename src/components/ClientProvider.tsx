"use client"

import { useEffect, useState, ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
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
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    if (!isClient) {
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
