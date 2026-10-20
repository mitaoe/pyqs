"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { subjectPageTitle } from "@/features/catalog/metadata"
import { requestedSubject } from "../requested-subject"
import SubjectPapersView from "./SubjectPapersView"

export default function UnknownSubject() {
  const subject = requestedSubject(usePathname(), useSearchParams()) ?? ""

  useEffect(() => {
    document.title = subjectPageTitle(subject)
  }, [subject])

  return <SubjectPapersView subject={subject} papers={[]} isKnownSubject={false} />
}
