import type { ReactNode } from "react"
import PageTransition from "@/components/animations/PageTransition"
import Layout from "@/components/layout/Layout"

export default function PapersLayout({ children }: { children: ReactNode }) {
  return (
    <Layout>
      <PageTransition>
        <div className="min-h-screen bg-primary text-content">{children}</div>
      </PageTransition>
    </Layout>
  )
}
