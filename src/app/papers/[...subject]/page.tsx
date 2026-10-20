import type { Metadata } from "next"
import PageTransition from "@/components/animations/PageTransition"
import Layout from "@/components/layout/Layout"
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

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  return subjectPageMetadata(await subjectFromParams(params))
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const subject = await subjectFromParams(params)
  const [subjects, papers] = await Promise.all([getSubjectNames(), getSubjectPapers(subject)])

  return (
    <Layout>
      <PageTransition>
        <div className="min-h-screen bg-primary text-content">
          <SubjectPapersView
            subject={subject}
            papers={papers}
            isKnownSubject={resolveSubject(subjects, subject) !== null}
          />
        </div>
      </PageTransition>
    </Layout>
  )
}
