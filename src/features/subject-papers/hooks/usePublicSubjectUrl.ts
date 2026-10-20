"use client"

import { useEffect } from "react"
import { subjectHref } from "@/features/catalog/subjects"

export function usePublicSubjectUrl(subject: string) {
  useEffect(() => {
    const publicUrl = subjectHref(subject)
    if (window.location.pathname + window.location.search !== publicUrl) {
      window.history.replaceState(null, "", publicUrl)
    }
  }, [subject])
}
