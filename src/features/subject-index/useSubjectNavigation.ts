"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { subjectPath } from "@/features/catalog/subjects"

export function useSubjectNavigation() {
  const router = useRouter()

  const openSubject = useCallback((subject: string) => router.push(subjectPath(subject)), [router])

  const prefetchSubject = useCallback(
    (subject: string) => router.prefetch(subjectPath(subject)),
    [router],
  )

  const prefetchHandlers = useCallback(
    (subject: string) => {
      const prefetch = () => prefetchSubject(subject)
      return { onPointerEnter: prefetch, onTouchStart: prefetch, onFocus: prefetch }
    },
    [prefetchSubject],
  )

  return { openSubject, prefetchSubject, prefetchHandlers }
}
