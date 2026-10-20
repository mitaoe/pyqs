import Layout from "@/components/layout/Layout"
import { papersIndexMetadata } from "@/features/catalog/metadata"
import { getSubjectNames } from "@/features/catalog/server/catalog"
import SubjectIndex from "@/features/subject-index/components/SubjectIndex"

export const revalidate = 86400

export const metadata = papersIndexMetadata

export default async function PapersPage() {
  const subjects = await getSubjectNames()

  return (
    <Layout>
      <SubjectIndex subjects={subjects} />
    </Layout>
  )
}
