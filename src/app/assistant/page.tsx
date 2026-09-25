import type { Metadata } from "next"
import Header from "@/components/layout/Header"
import PyqApp from "@/components/assistant/PyqApp"

export const metadata: Metadata = {
    title: "Ask AI — MITAoE PYQs",
    description:
        "Ask questions about previous-year question papers by subject — real frequency counts and answers grounded in actual past questions.",
}

/**
 * Standalone assistant page. Unlike the global split-view panel (which binds
 * to the browsed subject), this is the browse-all-subjects home: it lets the
 * user pick any subject in the corpus and remembers the last-used one in
 * localStorage. The mismatch state in the panel links here.
 */
export default function AssistantPage() {
    return (
        <div className="flex h-[100dvh] flex-col bg-primary text-content">
            <Header />
            <main className="min-h-0 flex-1">
                <PyqApp />
            </main>
        </div>
    )
}
