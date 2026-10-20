import { Suspense } from "react"
import PapersLoading from "@/features/subject-papers/components/PapersLoading"
import UnknownSubject from "@/features/subject-papers/components/UnknownSubject"

export default function SubjectNotFound() {
  return (
    <Suspense fallback={<PapersLoading />}>
      <UnknownSubject />
    </Suspense>
  )
}
