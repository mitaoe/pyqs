"use client"

import {
    createContext,
    useContext,
    useState,
    useMemo,
    useCallback,
    useEffect,
    ReactNode,
} from "react"

const WIDTH_KEY = "pyq.askai.width"
const DEFAULT_WIDTH = 448

/**
 * Clamp the desktop panel width: 35–45% of the viewport, but never below 360px
 * (keeps intents readable) and never above 640px (so on very large screens the
 * answer column doesn't become unreadably wide, and the list keeps most of the
 * width). At ≥1024px this guarantees the list stays ≥55% ≈ ≥560px, so the panel
 * never has to auto-collapse to keep the grid usable.
 */
function clampWidth(px: number): number {
    if (typeof window === "undefined") return px
    const w = window.innerWidth
    const hi = Math.min(640, Math.round(w * 0.45))
    const lo = Math.min(hi, Math.max(360, Math.round(w * 0.35)))
    return Math.min(Math.max(px, lo), hi)
}

interface AskAiContextType {
    /** Whether the split-view AskAI panel is open. */
    isOpen: boolean
    open: () => void
    close: () => void
    toggle: () => void
    /**
     * The subject the user is currently browsing (paper-browse pages push it
     * here from the route). Null when there is no browsing context. On such
     * pages the panel binds ONLY to this — never to localStorage.
     */
    browsedSubject: string | null
    setBrowsedSubject: (subject: string | null) => void
    /** Desktop panel width in px (35–45% band), remembered across sessions. */
    panelWidth: number
    setPanelWidth: (px: number) => void
    /** True at ≥1024px — the split (and citation threads) are desktop-only. */
    isDesktop: boolean
    /** False once a health probe shows the RAG backend absent/down → hide it all. */
    available: boolean
}

const AskAiContext = createContext<AskAiContextType | undefined>(undefined)

/**
 * Holds the open/closed state of the global AskAI panel, the current browsed
 * subject, and the remembered desktop panel width. Kept separate from the panel
 * component so any surface (the floating trigger, a future header button, a deep
 * link) can open it, and so the paper-browse pages can feed the route's subject
 * to the panel without the panel reaching into routing. Mounted app-wide inside
 * ClientProvider.
 */
export function AskAiProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [browsedSubject, setBrowsedSubjectState] = useState<string | null>(
        null
    )
    const [panelWidth, setPanelWidthState] = useState(DEFAULT_WIDTH)
    const [isDesktop, setIsDesktop] = useState(false)
    const [available, setAvailable] = useState(true)

    // One-shot health probe: if the RAG backend is absent (no DATABASE_URL) or
    // down, hide the whole assistant gracefully rather than offer a dead panel.
    useEffect(() => {
        let alive = true
        fetch("/api/health")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("health"))))
            .then((b: { ok?: boolean; db?: { ok?: boolean } }) => {
                if (alive && (b?.ok === false || b?.db?.ok === false))
                    setAvailable(false)
            })
            .catch(() => {
                if (alive) setAvailable(false)
            })
        return () => {
            alive = false
        }
    }, [])

    // Track the desktop breakpoint (client-only → SSR-safe, starts false).
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)")
        const update = () => setIsDesktop(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    // Restore the remembered width on mount (client-only → SSR-safe).
    useEffect(() => {
        try {
            const saved = localStorage.getItem(WIDTH_KEY)
            const px = saved
                ? parseInt(saved, 10)
                : Math.round(window.innerWidth * 0.4)
            if (!Number.isNaN(px)) setPanelWidthState(clampWidth(px))
        } catch {
            /* ignore; keep the default */
        }
    }, [])

    // Re-clamp on viewport resize / browser zoom so the panel stays in the
    // 35–45% band (and ≤640px) at the new width — never overruns the list.
    useEffect(() => {
        const onResize = () => setPanelWidthState((w) => clampWidth(w))
        window.addEventListener("resize", onResize, { passive: true })
        return () => window.removeEventListener("resize", onResize)
    }, [])

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen((v) => !v), [])
    const setBrowsedSubject = useCallback(
        (subject: string | null) => setBrowsedSubjectState(subject),
        []
    )
    const setPanelWidth = useCallback((px: number) => {
        const w = clampWidth(px)
        setPanelWidthState(w)
        try {
            localStorage.setItem(WIDTH_KEY, String(w))
        } catch {
            /* non-fatal — width just won't persist */
        }
    }, [])

    const value = useMemo(
        () => ({
            isOpen,
            open,
            close,
            toggle,
            browsedSubject,
            setBrowsedSubject,
            panelWidth,
            setPanelWidth,
            isDesktop,
            available,
        }),
        [
            isOpen,
            open,
            close,
            toggle,
            browsedSubject,
            setBrowsedSubject,
            panelWidth,
            setPanelWidth,
            isDesktop,
            available,
        ]
    )

    return (
        <AskAiContext.Provider value={value}>{children}</AskAiContext.Provider>
    )
}

export function useAskAi() {
    const context = useContext(AskAiContext)
    if (context === undefined) {
        throw new Error("useAskAi must be used within an AskAiProvider")
    }
    return context
}
