import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { subjectPageMetadata } from "@/features/catalog/metadata"
import { getSubjectNames, getSubjectPapers } from "@/features/catalog/server/catalog"
import { decodeSubjectParam, resolveSubject } from "@/features/catalog/subjects"
import SubjectPapersView from "@/features/subject-papers/components/SubjectPapersView"

export const revalidate = 86400

interface SubjectPageProps {
  params: Promise<{ subject: string[] }>
}

export async function generateStaticParams() {
  const subjects = await getSubjectNames()
  return subjects.map((subject) => ({ subject: subject.split("/") }))
}

async function resolveSubjectParam(params: SubjectPageProps["params"]) {
  const requested = (await params).subject.map(decodeSubjectParam).join("/")
  return resolveSubject(await getSubjectNames(), requested)
}

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  const subject = await resolveSubjectParam(params)
  return subject ? subjectPageMetadata(subject) : {}
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const subject = await resolveSubjectParam(params)
  if (!subject) notFound()

  return (
    <SubjectPapersView subject={subject} papers={await getSubjectPapers(subject)} isKnownSubject />
  )
}
