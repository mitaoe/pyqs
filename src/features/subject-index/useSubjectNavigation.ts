"use client"

import { useCallback, useEffect, useRef } from "react"
import type { FocusEvent, PointerEvent } from "react"
import { useRouter } from "next/navigation"
import { subjectPath } from "@/features/catalog/subjects"

const HOVER_INTENT_MS = 80

export function useSubjectNavigation() {
  const router = useRouter()
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const openSubject = useCallback((subject: string) => router.push(subjectPath(subject)), [router])

  const prefetchSubject = useCallback(
    (subject: string) => router.prefetch(subjectPath(subject)),
    [router],
  )

  const prefetchHandlers = useCallback(
    (subject: string) => ({
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return
        clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => prefetchSubject(subject), HOVER_INTENT_MS)
      },
      onPointerLeave: () => clearTimeout(hoverTimer.current),
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget.matches(":focus-visible")) prefetchSubject(subject)
      },
    }),
    [prefetchSubject],
  )

  return { openSubject, prefetchSubject, prefetchHandlers }
}
