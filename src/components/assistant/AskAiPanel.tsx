"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkle, X } from "@phosphor-icons/react"

import type { SubjectRow } from "@/lib/rag/api-types"
import { useAskAi } from "@/contexts/AskAiContext"
import Chat from "./Chat"
import StatsFooter from "./StatsFooter"
import SubjectPicker from "./SubjectPicker"

/* ---------- pure helpers (exported for tests) ---------- */

/**
 * Resolve a browsed subject name to the corpus's canonical subject, or null.
 * Exact match only (case-insensitive) — subject isolation is a hard rule, so
 * we never fuzzy-substitute a different subject.
 */
export function resolveSubject(
    browsed: string,
    subjects: SubjectRow[]
): string | null {
    const b = browsed.trim().toLowerCase()
    if (!b) return null
    return subjects.find((s) => s.subject.toLowerCase() === b)?.subject ?? null
}

const words = (s: string) =>
    s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** Closest corpus subjects to a name, for the mismatch hint + seam logging. */
export function nearestSubjects(
    browsed: string,
    subjects: SubjectRow[],
    k = 3
): string[] {
    const bWords = new Set(words(browsed))
    const bl = browsed.trim().toLowerCase()
    const scored = subjects
        .map((s) => {
            const shared = words(s.subject).filter((w) => bWords.has(w)).length
            const sl = s.subject.toLowerCase()
            const sub = bl && (sl.includes(bl) || bl.includes(sl)) ? 1 : 0
            return { subject: s.subject, count: s.question_count, score: shared * 2 + sub }
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.count - a.count)
    return scored.slice(0, k).map((x) => x.subject)
}

/* ---------- presentational body (exported for tests) ---------- */

type Mode = "browse" | "free"

export function AskAiPanelBody({
    subjects,
    loadError,
    mode,
    browsedSubject,
    effectiveSubject,
    questionCount,
    nearest,
    switchNotice,
    chatEpoch,
    onRetry,
    onPick,
    onChangeSubject,
}: {
    subjects: SubjectRow[] | null
    loadError: string | null
    mode: Mode
    browsedSubject: string | null
    effectiveSubject: string | null
    questionCount: number | null
    nearest: string[]
    switchNotice: string | null
    chatEpoch: number
    onRetry: () => void
    onPick: (s: string) => void
    onChangeSubject: () => void
}) {
    if (loadError) {
        return (
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-300">
                    <p>{loadError}</p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (!subjects) {
        return (
            <div
                className="space-y-2 px-4 py-4"
                aria-live="polite"
                aria-busy="true"
            >
                <div className="h-12 animate-pulse rounded-xl bg-accent" />
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="h-12 animate-pulse rounded-xl bg-content/5"
                    />
                ))}
            </div>
        )
    }

    // A subject is bound (browse match or free pick) → the conversation.
    if (effectiveSubject) {
        return (
            <>
                {switchNotice && (
                    <div
                        data-testid="switch-notice"
                        className="mx-4 mt-3 rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand"
                    >
                        Switched to {switchNotice}
                    </div>
                )}
                <div className="min-h-0 flex-1">
                    <Chat
                        key={chatEpoch}
                        embedded
                        subject={effectiveSubject}
                        questionCount={questionCount}
                        onChangeSubject={onChangeSubject}
                    />
                </div>
            </>
        )
    }

    // Browse mode with a browsed subject that has no corpus match → honest
    // no-data state. Never keep or substitute another subject.
    if (mode === "browse" && browsedSubject) {
        return (
            <div
                data-testid="subject-mismatch"
                className="flex-1 overflow-y-auto px-4 py-6"
            >
                <p className="text-base font-semibold text-content">
                    AI data isn&rsquo;t available for &ldquo;{browsedSubject}
                    &rdquo; yet.
                </p>
                <p className="mt-1.5 text-sm text-content/70">
                    This subject isn&rsquo;t in the question-paper analysis
                    corpus. Open the assistant to browse the subjects that are
                    available.
                </p>
                <a
                    href="/assistant"
                    className="mt-4 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
                >
                    Browse available subjects
                </a>
                {nearest.length > 0 && (
                    <p className="mt-4 text-xs text-content/60">
                        Closest available:{" "}
                        {nearest.map((n, i) => (
                            <span key={n}>
                                {i > 0 && ", "}
                                <span className="text-content/80">{n}</span>
                            </span>
                        ))}
                    </p>
                )}
            </div>
        )
    }

    // Free mode (no browsing context) → pick a subject to ask about.
    return (
        <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-3 text-sm text-content/70">
                Pick a subject to ask about its previous-year papers:
            </p>
            <SubjectPicker subjects={subjects} onSelect={onPick} />
            <StatsFooter />
        </div>
    )
}

/* ---------- container ---------- */

/**
 * RESPONSIVE MODEL (the integration's contract; the host pages keep their own
 * responsive design untouched):
 *   <1024px  — no split. Full-width host paper grid exactly as before; the
 *              floating "Ask AI" pill opens a full-height bottom sheet; no
 *              citation threads.
 *   1024–1279 — split allowed but constrained: panel ≥360px and the list keeps
 *              ≥55% (≈≥560px). The width clamp guarantees this, so the panel
 *              never has to auto-collapse to keep the grid usable.
 *   ≥1280    — full split: panel default ~40%, drag-resizable within 35–45%,
 *              the list gets the rest.
 *   ≥1920    — the panel caps at 640px so wide answers stay readable; the list
 *              absorbs the extra width.
 * The paper grid (.papers-grid) sizes columns to its own width (auto-fill), so
 * it degrades 4→3→2→1 as the panel takes space rather than squeezing.
 *
 * Global split-view AskAI panel: a right-docked split on desktop (lg+, paired
 * with the content push in ClientProvider) and a bottom sheet on mobile.
 *
 * Subject binding: on paper-browse pages the subject is ALWAYS the browsed
 * subject (from AskAiContext, fed by the route), validated against the corpus
 * /api/subjects list — never localStorage. An exact match binds and resets the
 * conversation with a "switched to X" notice; no match shows an honest no-data
 * state linking to /assistant, and logs the seam. Off browse pages ("free"
 * mode) the panel offers the subject picker (localStorage lives only on
 * /assistant).
 */
export default function AskAiPanel() {
    const { isOpen, close, browsedSubject, panelWidth, setPanelWidth, isDesktop } =
        useAskAi()

    const [subjects, setSubjects] = useState<SubjectRow[] | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [freePick, setFreePick] = useState<string | null>(null)
    const [picking, setPicking] = useState(false)
    const [switchNotice, setSwitchNotice] = useState<string | null>(null)
    const [chatEpoch, setChatEpoch] = useState(0)

    const prevMatchRef = useRef<string | null>(null)
    const loggedMismatchRef = useRef<string | null>(null)

    async function loadSubjects() {
        setLoadError(null)
        try {
            const res = await fetch("/api/subjects")
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const body = (await res.json()) as { subjects: SubjectRow[] }
            setSubjects(body.subjects)
        } catch {
            setLoadError(
                "Couldn't load the subject list. The database may be waking up."
            )
        }
    }

    useEffect(() => {
        if (isOpen && subjects === null && !loadError) void loadSubjects()
    }, [isOpen, subjects, loadError])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [isOpen, close])

    useEffect(() => {
        if (!isOpen) return
        if (window.matchMedia("(min-width: 1024px)").matches) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [isOpen])

    const mode: Mode = browsedSubject != null ? "browse" : "free"

    const browseMatch = useMemo(
        () =>
            browsedSubject && subjects
                ? resolveSubject(browsedSubject, subjects)
                : null,
        [browsedSubject, subjects]
    )

    const effectiveSubject =
        mode === "browse" ? browseMatch : picking ? null : freePick

    const effectiveRow = subjects?.find((s) => s.subject === effectiveSubject)
    const questionCount = effectiveRow?.question_count ?? null
    const examCount = effectiveRow?.exam_count ?? null

    const nearest = useMemo(
        () =>
            mode === "browse" && browsedSubject && subjects && !browseMatch
                ? nearestSubjects(browsedSubject, subjects, 3)
                : [],
        [mode, browsedSubject, subjects, browseMatch]
    )

    // On mount / subject navigation: when a browsed subject resolves to a new
    // match, reset the conversation and flash a "switched to X" notice.
    useEffect(() => {
        if (!isOpen) return
        if (browsedSubject && browseMatch) {
            if (prevMatchRef.current !== browseMatch) {
                prevMatchRef.current = browseMatch
                setChatEpoch((e) => e + 1)
                setSwitchNotice(browseMatch)
            }
        } else {
            prevMatchRef.current = null
        }
    }, [isOpen, browsedSubject, browseMatch])

    useEffect(() => {
        if (!switchNotice) return
        const t = setTimeout(() => setSwitchNotice(null), 3500)
        return () => clearTimeout(t)
    }, [switchNotice])

    // Log the naming seam once per distinct unmatched browsed subject.
    useEffect(() => {
        if (!isOpen || !browsedSubject || !subjects || browseMatch) return
        if (loggedMismatchRef.current === browsedSubject) return
        loggedMismatchRef.current = browsedSubject
        console.warn(
            "[askai] subject mismatch: no /api/subjects match for browsed subject",
            {
                browsed: browsedSubject,
                nearest: nearestSubjects(browsedSubject, subjects, 3),
            }
        )
    }, [isOpen, browsedSubject, subjects, browseMatch])

    function pickFree(s: string) {
        setFreePick(s)
        setPicking(false)
    }

    const chip =
        "rounded-lg border border-accent px-2.5 py-1 text-xs font-medium text-content/80 transition-colors hover:bg-accent"

    // Drag the left edge to resize (desktop only); width is clamped + persisted.
    const startResize = (e: React.PointerEvent) => {
        e.preventDefault()
        const onMove = (ev: PointerEvent) =>
            setPanelWidth(window.innerWidth - ev.clientX)
        const onUp = () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            document.body.style.userSelect = ""
        }
        document.body.style.userSelect = "none"
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
    }

    // The panel stays mounted (translated off-screen when closed) so the
    // conversation survives close/reopen. Desktop slides on X (right-docked
    // split), mobile on Y (bottom sheet). BOTH axes are always specified: if we
    // only set the active axis, framer-motion keeps the previous axis's stale
    // value when the breakpoint flips (isDesktop starts false → the initial
    // y:"100%" would leak into desktop, dropping the open panel below the
    // viewport → the empty-right-pane bug).
    const animate = {
        x: isDesktop && !isOpen ? "100%" : 0,
        y: !isDesktop && !isOpen ? "100%" : 0,
    }

    return (
        <>
            <AnimatePresence>
                {isOpen && !isDesktop && (
                    <motion.div
                        key="askai-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={close}
                        className="fixed inset-0 z-[59] bg-black/50"
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            <motion.aside
                initial={false}
                animate={animate}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                role="dialog"
                aria-modal={isOpen ? "true" : undefined}
                aria-label="Ask AI"
                aria-hidden={!isOpen}
                inert={!isOpen ? true : undefined}
                data-askai-panel=""
                style={{
                    ...(isDesktop ? { width: panelWidth } : {}),
                    pointerEvents: isOpen ? undefined : "none",
                }}
                className={`askai-glass fixed z-[60] flex flex-col border-accent/60 text-content shadow-2xl ${
                    isDesktop
                        ? "right-0 top-0 h-[100dvh] border-l"
                        : "inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl border-t"
                }`}
            >
                {isDesktop && (
                            <div
                                onPointerDown={startResize}
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize Ask AI panel"
                                className="group absolute left-0 top-0 z-10 flex h-full w-2 -translate-x-1/2 cursor-col-resize items-stretch justify-center"
                            >
                                <span className="h-full w-px bg-transparent transition-colors group-hover:bg-brand/40" />
                            </div>
                        )}
                        <div className="flex items-center gap-2 border-b border-accent/60 px-4 py-3">
                            <Sparkle
                                weight="fill"
                                className="h-5 w-5 shrink-0 text-brand"
                            />
                            <div className="min-w-0">
                                <span className="block truncate text-sm font-bold">
                                    {effectiveSubject ?? "Ask AI"}
                                </span>
                                {effectiveSubject && questionCount != null && (
                                    <p className="truncate text-xs text-content/60">
                                        {questionCount.toLocaleString()} questions
                                        {examCount != null
                                            ? ` · ${examCount.toLocaleString()} exams`
                                            : ""}
                                    </p>
                                )}
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                {effectiveSubject && (
                                    <button
                                        type="button"
                                        onClick={() => setChatEpoch((e) => e + 1)}
                                        className={chip}
                                    >
                                        New chat
                                    </button>
                                )}
                                {mode === "free" && effectiveSubject && (
                                    <button
                                        type="button"
                                        onClick={() => setPicking(true)}
                                        className={chip}
                                    >
                                        Change
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="Close Ask AI"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-content/70 transition-colors hover:bg-accent hover:text-content"
                                >
                                    <X weight="bold" className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col">
                            <AskAiPanelBody
                                subjects={subjects}
                                loadError={loadError}
                                mode={mode}
                                browsedSubject={browsedSubject}
                                effectiveSubject={effectiveSubject}
                                questionCount={questionCount}
                                nearest={nearest}
                                switchNotice={switchNotice}
                                chatEpoch={chatEpoch}
                                onRetry={() => void loadSubjects()}
                                onPick={pickFree}
                                onChangeSubject={() => setPicking(true)}
                            />
                        </div>
            </motion.aside>
        </>
    )
}
