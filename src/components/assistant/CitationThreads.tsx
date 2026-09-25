"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAskAi } from "@/contexts/AskAiContext"

/**
 * Two-state ambient/citation threads. One full-viewport SVG overlay
 * (pointer-events:none, aria-hidden, z-40 — above content, below panel/modals),
 * desktop-only, hidden while a preview modal is up. Client-only → SSR-safe.
 *
 *   IDLE   (panel open, no cited answer): quiet ambient threads from every
 *          visible paper card to a single pulsing anchor dot on the panel's
 *          left edge — "the archive is wired to the AI". Thinner + fainter than
 *          citation threads.
 *   ACTIVE (a cited answer on screen): citation threads from the answer's Source
 *          rows to the matching cards; the idle dot + ambient threads retract.
 *
 * Both states share the same rAF-batched recompute (passive capture-scroll +
 * resize + ResizeObserver + MutationObserver), the same cached element lookups,
 * the same 8-thread cap, and the same edge-case handling. The idle pulse is
 * CSS-only (no per-frame JS). prefers-reduced-motion → instant swap, no pulse.
 */

type Kind = "cite" | "idle"

interface Thread {
    key: string
    file: string
    kind: Kind
    d: string
    faded: boolean // cite only: clamped to the list edge (card scrolled off)
}

const MAX_THREADS = 8 // citation threads (specific cited papers)
const IDLE_MAX = 16 // ambient idle fan — every visible card, bounded for safety
const SCROLL_ID = "scrollable-content"

/** Gentle, direction-agnostic horizontal S-curve (control points at mid-x). */
function bezier(sx: number, sy: number, ex: number, ey: number): string {
    const mx = (sx + ex) / 2
    return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`
}

export default function CitationThreads() {
    const { isOpen, isDesktop } = useAskAi()
    const [mounted, setMounted] = useState(false)
    const [threads, setThreads] = useState<Thread[]>([])
    const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
    const [hoveredFile, setHoveredFile] = useState<string | null>(null)
    const [reduced, setReduced] = useState(false)
    const rafRef = useRef<number | null>(null)
    // Cache the expensive element lookups; rebuild only when the DOM set changes
    // (a MutationObserver marks it dirty). Rects re-measure each frame (they move
    // on scroll) but the O(cards) querySelectorAll stays off the rAF hot path.
    const cardByFileRef = useRef<Map<string, HTMLElement>>(new Map())
    const rowsRef = useRef<HTMLElement[]>([])
    const dirtyRef = useRef(true)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const u = () => setReduced(mq.matches)
        u()
        mq.addEventListener("change", u)
        return () => mq.removeEventListener("change", u)
    }, [])

    // Reflect the hovered/focused file onto its row + card (brand ring, globals).
    useEffect(() => {
        document
            .querySelectorAll("[data-thread-emph]")
            .forEach((el) => el.removeAttribute("data-thread-emph"))
        if (!hoveredFile) return
        document
            .querySelectorAll<HTMLElement>("[data-source-file],[data-paper-file]")
            .forEach((el) => {
                const f = el.dataset.sourceFile ?? el.dataset.paperFile
                if (f === hoveredFile) el.setAttribute("data-thread-emph", "1")
            })
    }, [hoveredFile])

    useEffect(() => {
        if (!mounted) return
        if (!isOpen || !isDesktop) {
            setThreads([])
            setAnchor(null)
            return
        }

        const compute = () => {
            rafRef.current = null
            const panelEl =
                document.querySelector<HTMLElement>("[data-askai-panel]")
            // Any preview/overlay up, or no panel → no threads.
            if (document.querySelector("[data-pdf-modal]") || !panelEl) {
                setThreads([])
                setAnchor(null)
                return
            }
            // Rebuild the row/card lookups only when the DOM set changed.
            if (dirtyRef.current) {
                rowsRef.current = Array.from(
                    document.querySelectorAll<HTMLElement>(
                        "[data-sources-active] [data-source-file]"
                    )
                )
                const m = new Map<string, HTMLElement>()
                // First card per file (duplicate uploads collapse to the first).
                document
                    .querySelectorAll<HTMLElement>("[data-paper-file]")
                    .forEach((el) => {
                        const f = el.dataset.paperFile
                        if (f && !m.has(f)) m.set(f, el)
                    })
                cardByFileRef.current = m
                dirtyRef.current = false
            }
            const rows = rowsRef.current
            const cardByFile = cardByFileRef.current
            const scroller = document.getElementById(SCROLL_ID)
            const listRect = scroller?.getBoundingClientRect()

            // ── ACTIVE: a cited answer is on screen ──
            if (rows.length > 0) {
                const out: Thread[] = []
                const seen = new Set<string>()
                for (const row of rows) {
                    if (out.length >= MAX_THREADS) break
                    if (!row.isConnected) continue
                    const file = row.dataset.sourceFile
                    if (!file || seen.has(file)) continue
                    const card = cardByFile.get(file)
                    if (!card || !card.isConnected) continue
                    seen.add(file)
                    const r = row.getBoundingClientRect()
                    const c = card.getBoundingClientRect()
                    const sx = r.left
                    const sy = r.top + r.height / 2
                    const ex = c.right
                    let ey = c.top + c.height / 2
                    let faded = false
                    if (listRect) {
                        const top = listRect.top + 4
                        const bot = listRect.bottom - 4
                        if (ey < top) {
                            ey = top
                            faded = true
                        } else if (ey > bot) {
                            ey = bot
                            faded = true
                        }
                    }
                    out.push({
                        key: `cite-${file}`,
                        file,
                        kind: "cite",
                        d: bezier(sx, sy, ex, ey),
                        faded,
                    })
                }
                setThreads(out)
                setAnchor(null)
                return
            }

            // ── IDLE: ambient fan from EVERY visible card (all columns) to the
            // dot. Connecting only the nearest cards left a whole far column
            // threadless (reads as a bug); a fan to one point isn't a hairball.
            // Bounded for safety on dense grids — DOM order keeps top rows, so
            // every column stays represented.
            const pr = panelEl.getBoundingClientRect()
            const ax = pr.left
            const ay = pr.top + pr.height / 2
            const out: Thread[] = []
            for (const card of cardByFile.values()) {
                if (out.length >= IDLE_MAX) break
                if (!card.isConnected) continue
                const c = card.getBoundingClientRect()
                if (c.width === 0) continue
                if (listRect && (c.bottom < listRect.top || c.top > listRect.bottom))
                    continue // scrolled out of the list viewport
                const file = card.dataset.paperFile!
                out.push({
                    key: `idle-${file}`,
                    file,
                    kind: "idle",
                    d: bezier(c.right, c.top + c.height / 2, ax, ay),
                    faded: false,
                })
            }
            setThreads(out)
            setAnchor(out.length ? { x: ax, y: ay } : null)
        }

        const schedule = () => {
            if (rafRef.current == null)
                rafRef.current = requestAnimationFrame(compute)
        }
        const scheduleDirty = () => {
            dirtyRef.current = true
            schedule()
        }

        dirtyRef.current = true
        schedule()

        window.addEventListener("scroll", schedule, { passive: true, capture: true })
        window.addEventListener("resize", schedule, { passive: true })

        const ro = new ResizeObserver(schedule)
        const list = document.querySelector("[data-papers-list]")
        const panel = document.querySelector("[data-askai-panel]")
        const scroller = document.getElementById(SCROLL_ID)
        if (list) ro.observe(list)
        if (panel) ro.observe(panel)
        if (scroller) ro.observe(scroller)

        // Card set changes (filter/search/view toggle) + the active answer moving.
        const mo = new MutationObserver(scheduleDirty)
        if (list)
            mo.observe(list, { childList: true, subtree: true, attributes: true })
        if (panel)
            mo.observe(panel, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-sources-active"],
            })
        const bodyMo = new MutationObserver(scheduleDirty)
        bodyMo.observe(document.body, { childList: true })

        const onEnter = (e: Event) => {
            const el = (e.target as HTMLElement)?.closest?.(
                "[data-source-file],[data-paper-file]"
            ) as HTMLElement | null
            if (!el) return
            setHoveredFile(el.dataset.sourceFile ?? el.dataset.paperFile ?? null)
        }
        const onLeave = (e: Event) => {
            const related = (e as PointerEvent).relatedTarget as HTMLElement | null
            if (related?.closest?.("[data-source-file],[data-paper-file]")) return
            setHoveredFile(null)
        }
        document.addEventListener("pointerover", onEnter)
        document.addEventListener("pointerout", onLeave)
        document.addEventListener("focusin", onEnter)
        document.addEventListener("focusout", onLeave)

        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
            window.removeEventListener("scroll", schedule, {
                capture: true,
            } as EventListenerOptions)
            window.removeEventListener("resize", schedule)
            ro.disconnect()
            mo.disconnect()
            bodyMo.disconnect()
            document.removeEventListener("pointerover", onEnter)
            document.removeEventListener("pointerout", onLeave)
            document.removeEventListener("focusin", onEnter)
            document.removeEventListener("focusout", onLeave)
            setHoveredFile(null)
        }
    }, [mounted, isOpen, isDesktop])

    if (!mounted || !isOpen || !isDesktop) return null

    const styleFor = (t: Thread) => {
        const emph = hoveredFile === t.file
        if (t.kind === "idle") {
            return { opacity: emph ? 0.34 : 0.17, strokeWidth: emph ? 1.5 : 1 }
        }
        return {
            opacity: emph ? 0.7 : t.faded ? 0.12 : 0.35,
            strokeWidth: emph ? 2 : 1.25,
        }
    }

    return (
        <>
            {threads.length > 0 && (
                <svg
                    className="pointer-events-none fixed inset-0 z-40 h-full w-full"
                    aria-hidden="true"
                    data-citation-threads=""
                >
                    <AnimatePresence>
                        {threads.map((t) => {
                            const { opacity, strokeWidth } = styleFor(t)
                            if (reduced) {
                                return (
                                    <path
                                        key={t.key}
                                        data-thread-kind={t.kind}
                                        d={t.d}
                                        fill="none"
                                        style={{ stroke: "hsl(var(--brand))" }}
                                        opacity={opacity}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                    />
                                )
                            }
                            return (
                                <motion.path
                                    key={t.key}
                                    data-thread-kind={t.kind}
                                    d={t.d}
                                    fill="none"
                                    style={{ stroke: "hsl(var(--brand))" }}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        pathLength: { duration: 0.5, ease: "easeOut" },
                                        opacity: { duration: 0.25 },
                                    }}
                                />
                            )
                        })}
                    </AnimatePresence>
                </svg>
            )}

            {/* Idle anchor dot on the panel's left edge — pulses via CSS. */}
            <AnimatePresence>
                {anchor && (
                    <motion.div
                        key="idle-anchor"
                        data-idle-anchor=""
                        aria-hidden="true"
                        className="pointer-events-none fixed z-[61]"
                        style={{ left: anchor.x - 5, top: anchor.y - 5 }}
                        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                        transition={{ duration: reduced ? 0 : 0.3 }}
                    >
                        <span className="askai-idle-dot block h-2.5 w-2.5 rounded-full" />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
