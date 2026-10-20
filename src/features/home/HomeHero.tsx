"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import FadeIn from "@/components/animations/FadeIn"

export default function HomeHero() {
  return (
    <div className="flex min-h-[76vh] flex-col items-center justify-center px-4 text-center">
      <FadeIn from="top" duration={0.8}>
        <div className="mb-6">
          <h1 className="text-7xl font-bold tracking-tighter text-content sm:text-8xl">PYQs</h1>
          <p className="mt-2 text-lg text-content/80">MITAoE Question Papers</p>
        </div>

        <p className="mb-12 max-w-md text-center text-sm text-content/60">
          Access previous year question papers to prepare for your exams
        </p>
      </FadeIn>

      <FadeIn delay={0.3} duration={0.6}>
        <div className="relative">
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
              className="flex h-14 w-[250px] items-center justify-center overflow-hidden rounded-full px-4 text-sm font-medium text-primary shadow-lg shadow-white/5 relative group bg-blue-600/70 text-white transition-all duration-300 hover:bg-blue-500/80"
            >
              <MagnifyingGlass weight="bold" className="mr-3" size={24} />
              <span className="whitespace-nowrap">Search Papers</span>
            </Link>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  )
}
