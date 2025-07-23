"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Layout from "@/components/layout/Layout"
import { usePapers, LoadingStatus } from "@/contexts/PaperContext"
import { MagnifyingGlass } from "@phosphor-icons/react"
import FadeIn from "@/components/animations/FadeIn"
import LottieAnimation from "@/components/animations/LottieAnimation"
import { motion } from "framer-motion"

export default function HomePage() {
    const { dataReady, isLoading, loadingStatus, prefetchData } = usePapers()
    const [isClient, setIsClient] = useState(false)

    // Avoid hydration mismatch
    useEffect(() => {
        setIsClient(true)
    }, [])

    // This effect runs after the component mounts to prevent hydration mismatch
    useEffect(() => {
        if (isClient && !dataReady && !isLoading) {
            prefetchData()
        }
    }, [isClient, dataReady, isLoading, prefetchData])

    if (!isClient) {
        return null
    }

    // Helper to get the loading message based on loading status
    const getLoadingMessage = () => {
        switch (loadingStatus) {
            case LoadingStatus.METADATA_LOADING:
                return "Loading metadata..."
            case LoadingStatus.PAPERS_LOADING:
                return "Fetching papers..."
            case LoadingStatus.DIRECTORY_LOADING:
                return "Organizing papers..."
            default:
                return "Loading papers..."
        }
    }

    // Common button styling for consistency
    const buttonClasses =
        "flex h-14 w-[250px] items-center justify-center overflow-hidden rounded-full px-4 text-sm font-medium text-primary shadow-lg shadow-white/5"

    return (
        <Layout>
            <div className="flex min-h-[76vh] flex-col items-center justify-center px-4 text-center">
                {/* Main Title with gradient effect */}
                <FadeIn from="top" duration={0.8}>
                    <div className="mb-6">
                        <h1 className="text-7xl font-bold tracking-tighter text-content sm:text-8xl">
                            PYQs
                        </h1>
                        <p className="mt-2 text-lg text-content/80">
                            MITAoE Question Papers
                        </p>
                    </div>

                    {/* Stylish subtitle */}
                    <p className="mb-12 max-w-md text-center text-sm text-content/60">
                        Access previous year question papers to prepare for your
                        exams
                    </p>
                </FadeIn>

                <FadeIn delay={0.3} duration={0.6}>
                    {/* Consistent button styling for both states */}
                    <div className="relative">
                        {isLoading ? (
                            <div
                                className={`${buttonClasses} bg-blue-500/60 text-white`}
                            >
                                <div className="mr-3 flex h-16 w-16 items-center justify-center">
                                    <LottieAnimation
                                        animationName="loading"
                                        height={64}
                                        width={64}
                                    />
                                </div>
                                <span className="whitespace-nowrap">
                                    {getLoadingMessage()}
                                </span>
                            </div>
                        ) : (
                            <motion.div
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 17,
                                }}
                            >
                                <Link
                                    href="/papers"
                                    className={`${buttonClasses} relative group bg-blue-600/70 text-white transition-all duration-300 hover:bg-blue-500/80 ${
                                        !dataReady
                                            ? "cursor-not-allowed opacity-50"
                                            : ""
                                    }`}
                                    onClick={(e) =>
                                        !dataReady && e.preventDefault()
                                    }
                                >
                                    <MagnifyingGlass
                                        weight="bold"
                                        className="mr-3"
                                        size={24}
                                    />
                                    <span className="whitespace-nowrap">
                                        Search Papers
                                    </span>
                                </Link>
                            </motion.div>
                        )}
                    </div>
                </FadeIn>
            </div>
        </Layout>
    )
}
