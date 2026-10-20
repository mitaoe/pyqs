import { Suspense } from "react"
import Layout from "@/components/layout/Layout"
import BrowseContent from "@/features/directory-browser/BrowseContent"
import { generateMetadata } from "./metadata"

export { generateMetadata }

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-content/60">Loading directory...</div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Layout>
      <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-500">
        <strong>Developer Notice:</strong> This page is now hidden from regular navigation but
        maintained for development and verification purposes.
      </div>
      <Suspense fallback={<LoadingFallback />}>
        <BrowseContent />
      </Suspense>
    </Layout>
  )
}
