"use client"

import { ReactNode, useEffect } from "react"
import { ThemeProvider } from "next-themes"
import GhostCursor from "@/components/animations/GhostCursor"
import { removeLegacyCatalogCache } from "@/features/catalog/legacy-cache"
import ServerStatusBanner from "@/features/server-status/ServerStatusBanner"
import { ServerStatusProvider } from "@/features/server-status/ServerStatusProvider"
import { SettingsProvider, useSettings } from "@/features/settings/SettingsProvider"

function Cursor() {
  const { cursorStyle } = useSettings()
  return cursorStyle === "ghost" ? <GhostCursor /> : null
}

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(removeLegacyCatalogCache, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ServerStatusProvider>
        <SettingsProvider>
          <ServerStatusBanner />
          {children}
          <Cursor />
        </SettingsProvider>
      </ServerStatusProvider>
    </ThemeProvider>
  )
}
