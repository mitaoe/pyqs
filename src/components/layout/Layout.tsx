import { ReactNode } from "react"
import { Toaster } from "sonner"
import Header from "./Header"
import Footer from "./Footer"

interface LayoutProps {
    children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen select-none flex-col bg-primary text-content">
            <Header />
            <main className="flex-1 overflow-hidden">
                <div
                    id="scrollable-content"
                    className="h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4"
                >
                    <div className="container mx-auto">{children}</div>
                </div>
            </main>
            <Footer />
            <Toaster
                position="bottom-right"
                theme="dark"
                closeButton
                richColors
            />
        </div>
    )
}
