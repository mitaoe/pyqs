"use client"

import { useEffect } from "react"
import { subjectHref } from "@/features/catalog/subjects"

export function usePublicSubjectUrl(subject: string) {
  useEffect(() => {
    const { pathname, search, hash } = window.location
    if (pathname === "/papers" || subject.includes("/")) return

    const otherParams = new URLSearchParams(search)
    otherParams.delete("subject")
    const extra = otherParams.toString()
    window.history.replaceState(
      null,
      "",
      `${subjectHref(subject)}${extra ? `&${extra}` : ""}${hash}`,
    )
  }, [subject])
}
