"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useSpring, useMotionValue } from "framer-motion"
import { useTheme } from "next-themes"
import LottieAnimation from "./LottieAnimation"

interface GhostCursorProps {
    enabled?: boolean
}

// Type definitions for Lottie animation data
interface LottieColorProperty {
    a: number
    k: number[]
    ix: number
}

interface LottieJSON {
    v: string
    fr: number
    ip: number
    op: number
    w: number
    h: number
    nm: string
    ddd: number
    assets: unknown[]
    layers: unknown[]
    [key: string]: unknown
}

export default function GhostCursor({ enabled = true }: GhostCursorProps) {
    const [isClient, setIsClient] = useState(false)
    const [animationData, setAnimationData] = useState<LottieJSON | null>(null)
    const cursorRef = useRef<HTMLDivElement>(null)
    const { theme, resolvedTheme } = useTheme()

    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    const springX = useSpring(mouseX, {
        stiffness: 100,
        damping: 20,
        mass: 0.5,
    })

    const springY = useSpring(mouseY, {
        stiffness: 100,
        damping: 20,
        mass: 0.5,
    })

    // Function to modify animation colors based on theme
    const modifyAnimationColors = (
        originalData: LottieJSON,
        isDarkMode: boolean
    ): LottieJSON | null => {
        if (!originalData) return null

        // Create a deep copy of the animation data
        const modifiedData = JSON.parse(
            JSON.stringify(originalData)
        ) as LottieJSON

        // Define colors based on theme
        const ghostBodyColor = isDarkMode ? [1, 1, 1, 1] : [0.25, 0.25, 0.25, 1] // white for dark mode, darker gray for light mode
        const strokeColor = isDarkMode
            ? [0.435, 0.435, 0.435, 1]
            : [0.2, 0.2, 0.2, 1] // gray for dark mode, darker gray for light mode
        const eyesFillColor = isDarkMode
            ? [0.945, 0.949, 0.949, 1]
            : [0.945, 0.949, 0.949, 1] // light gray (keep same for contrast)
        const shadowColor = isDarkMode
            ? [0.863, 0.867, 0.871, 1]
            : [0.4, 0.4, 0.4, 1] // light gray for dark mode, darker gray for light mode

        // Function to recursively find and update colors
        const updateColors = (obj: unknown): void => {
            if (typeof obj !== "object" || obj === null) return

            if (Array.isArray(obj)) {
                obj.forEach(updateColors)
                return
            }

            const item = obj as Record<string, unknown>

            // Update fill colors
            if (item.ty === "fl" && item.c && typeof item.c === "object") {
                const colorProp = item.c as LottieColorProperty
                if (colorProp.k && Array.isArray(colorProp.k)) {
                    // Check if this is the main ghost body (white fill)
                    if (
                        JSON.stringify(colorProp.k) ===
                        JSON.stringify([1, 1, 1, 1])
                    ) {
                        colorProp.k = ghostBodyColor
                    }
                    // Check if this is the eyes fill (light gray)
                    else if (
                        JSON.stringify(colorProp.k) ===
                        JSON.stringify([
                            0.945098099054, 0.949019667682, 0.949019667682, 1,
                        ])
                    ) {
                        colorProp.k = eyesFillColor
                    }
                    // Check if this is the shadow fill
                    else if (
                        JSON.stringify(colorProp.k) ===
                        JSON.stringify([
                            0.862745157878, 0.866666726505, 0.870588295133, 1,
                        ])
                    ) {
                        colorProp.k = shadowColor
                    }
                }
            }

            // Update stroke colors
            if (item.ty === "st" && item.c && typeof item.c === "object") {
                const colorProp = item.c as LottieColorProperty
                if (colorProp.k && Array.isArray(colorProp.k)) {
                    if (
                        JSON.stringify(colorProp.k) ===
                        JSON.stringify([
                            0.43529411764705883, 0.43529411764705883,
                            0.43529411764705883, 1,
                        ])
                    ) {
                        colorProp.k = strokeColor
                    }
                }
            }

            // Recursively process all properties
            Object.values(item).forEach(updateColors)
        }

        updateColors(modifiedData)
        return modifiedData
    }

    useEffect(() => {
        setIsClient(true)

        if (!enabled) return

        const updateMousePosition = (e: MouseEvent) => {
            mouseX.set(e.clientX)
            mouseY.set(e.clientY)
        }

        window.addEventListener("mousemove", updateMousePosition)

        return () => {
            window.removeEventListener("mousemove", updateMousePosition)
        }
    }, [enabled, mouseX, mouseY])

    // Load and modify animation data when theme changes
    useEffect(() => {
        const loadAndModifyAnimation = async () => {
            if (!isClient) return

            try {
                const response = await fetch("/animations/cursor.json")
                const originalData = (await response.json()) as LottieJSON

                // Use resolvedTheme to get the actual current theme
                const isDarkMode = resolvedTheme === "dark"
                const modifiedData = modifyAnimationColors(
                    originalData,
                    isDarkMode
                )

                setAnimationData(modifiedData)
            } catch (error) {
                console.error(
                    "Failed to load and modify cursor animation:",
                    error
                )
            }
        }

        loadAndModifyAnimation()
    }, [isClient, theme, resolvedTheme])

    if (!isClient || !enabled || !animationData) return null

    return (
        <motion.div
            ref={cursorRef}
            className="pointer-events-none fixed left-0 top-0 z-50 h-20 w-20"
            style={{
                x: springX,
                y: springY,
                translateX: "-50%",
                translateY: "-50%",
            }}
        >
            <LottieAnimation
                animationData={animationData}
                height={80}
                width={80}
            />
        </motion.div>
    )
}
