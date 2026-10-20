"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "@phosphor-icons/react"

export default function BackToSubjectsButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push("/papers")}
      className="p-2 sm:p-2.5 rounded-lg bg-secondary text-content/80 transition-colors hover:text-brand"
      aria-label="Back to Subjects"
    >
      <ArrowLeft size={18} weight="bold" />
    </button>
  )
}
