"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Sparkle } from "@phosphor-icons/react"
import { useAskAi } from "@/contexts/AskAiContext"

/**
 * Floating global trigger for the AskAI panel. Present on every page (mounted
 * in ClientProvider); hides itself while the panel is open since the panel
 * carries its own close control.
 */
export default function AskAiFab() {
    const { isOpen, open } = useAskAi()

    return (
        <AnimatePresence>
            {!isOpen && (
                <motion.button
                    type="button"
                    onClick={open}
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    aria-label="Ask AI about previous-year question papers"
                    className="fixed bottom-5 right-5 z-[55] flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand/90 sm:bottom-6 sm:right-6"
                >
                    <Sparkle weight="fill" className="h-5 w-5" />
                    <span className="hidden sm:inline">Ask AI</span>
                </motion.button>
            )}
        </AnimatePresence>
    )
}
