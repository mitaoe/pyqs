import type { Metadata } from "next"
import { subjectPageMetadata } from "@/features/catalog/metadata"
import { getSubjectNames, getSubjectPapers } from "@/features/catalog/server/catalog"
import { decodeSubjectParam, resolveSubject } from "@/features/catalog/subjects"
import SubjectPapersView from "@/features/subject-papers/components/SubjectPapersView"

export const revalidate = 86400
export const dynamicParams = true

interface SubjectPageProps {
  params: Promise<{ subject: string[] }>
}

export async function generateStaticParams() {
  const subjects = await getSubjectNames()
  return subjects.map((subject) => ({ subject: subject.split("/") }))
}

async function subjectFromParams(params: SubjectPageProps["params"]) {
  return (await params).subject.map(decodeSubjectParam).join("/")
}

async function isKnownSubject(subject: string) {
  return resolveSubject(await getSubjectNames(), subject) !== null
}

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  const subject = await subjectFromParams(params)
  const metadata = subjectPageMetadata(subject)
  return (await isKnownSubject(subject))
    ? metadata
    : { ...metadata, robots: { index: false, follow: false } }
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const subject = await subjectFromParams(params)
  const [known, papers] = await Promise.all([isKnownSubject(subject), getSubjectPapers(subject)])

  return <SubjectPapersView subject={subject} papers={papers} isKnownSubject={known} />
}
