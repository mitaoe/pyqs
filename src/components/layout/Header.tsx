"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import SettingsPopup from "../settings/SettingsPopup"
import { FaGithub } from "react-icons/fa"
import { IoMdSettings } from "react-icons/io"

export default function Header() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const popupRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                popupRef.current &&
                !popupRef.current.contains(event.target as Node)
            ) {
                setIsSettingsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [popupRef])

    return (
        <header className="sticky top-0 z-50 border-b border-accent bg-primary">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link
                    href="/"
                    className="text-xl font-bold tracking-tight text-content hover:text-content/80"
                >
                    <span className="ml-1 text-content">MITAoE PYQs</span>
                </Link>

                <div className="flex items-center space-x-4">
                    <div className="relative" ref={popupRef}>
                        <motion.button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="text-content/80 transition-colors hover:text-content flex items-center justify-center"
                            aria-label="Open settings"
                            animate={{ rotate: isSettingsOpen ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <IoMdSettings className="h-7 w-7" />
                        </motion.button>
                        {isSettingsOpen && <SettingsPopup />}
                    </div>
                    <a
                        href="https://github.com/mitaoe/pyqs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-content/80 transition-colors hover:text-content flex items-center justify-center"
                        aria-label="View source on GitHub"
                    >
                        {/* ahh so i have deleted the svg file and replaced it with the react-icons/fa */}
                        <FaGithub className="h-6 w-6" />
                    </a>
                </div>
            </div>
        </header>
    )
}
