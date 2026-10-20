"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useSpring, useMotionValue } from "motion/react"
import { useTheme } from "next-themes"
import { useIsHydrated } from "@/hooks/useIsHydrated"
import LottieAnimation from "./LottieAnimation"

interface GhostCursorProps {
  enabled?: boolean
}

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
  const isHydrated = useIsHydrated()
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

  const modifyAnimationColors = (
    originalData: LottieJSON,
    isDarkMode: boolean,
  ): LottieJSON | null => {
    if (!originalData) return null

    const modifiedData = JSON.parse(JSON.stringify(originalData)) as LottieJSON

    const ghostBodyColor = isDarkMode ? [1, 1, 1, 1] : [0.25, 0.25, 0.25, 1]
    const strokeColor = isDarkMode ? [0.435, 0.435, 0.435, 1] : [0.2, 0.2, 0.2, 1]
    const eyesFillColor = isDarkMode ? [0.945, 0.949, 0.949, 1] : [0.945, 0.949, 0.949, 1]
    const shadowColor = isDarkMode ? [0.863, 0.867, 0.871, 1] : [0.4, 0.4, 0.4, 1]

    const updateColors = (obj: unknown): void => {
      if (typeof obj !== "object" || obj === null) return

      if (Array.isArray(obj)) {
        obj.forEach(updateColors)
        return
      }

      const item = obj as Record<string, unknown>

      if (item.ty === "fl" && item.c && typeof item.c === "object") {
        const colorProp = item.c as LottieColorProperty
        if (colorProp.k && Array.isArray(colorProp.k)) {
          if (JSON.stringify(colorProp.k) === JSON.stringify([1, 1, 1, 1])) {
            colorProp.k = ghostBodyColor
          } else if (
            JSON.stringify(colorProp.k) ===
            JSON.stringify([0.945098099054, 0.949019667682, 0.949019667682, 1])
          ) {
            colorProp.k = eyesFillColor
          } else if (
            JSON.stringify(colorProp.k) ===
            JSON.stringify([0.862745157878, 0.866666726505, 0.870588295133, 1])
          ) {
            colorProp.k = shadowColor
          }
        }
      }

      if (item.ty === "st" && item.c && typeof item.c === "object") {
        const colorProp = item.c as LottieColorProperty
        if (colorProp.k && Array.isArray(colorProp.k)) {
          if (
            JSON.stringify(colorProp.k) ===
            JSON.stringify([0.43529411764705883, 0.43529411764705883, 0.43529411764705883, 1])
          ) {
            colorProp.k = strokeColor
          }
        }
      }

      Object.values(item).forEach(updateColors)
    }

    updateColors(modifiedData)
    return modifiedData
  }

  useEffect(() => {
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

  useEffect(() => {
    const loadAndModifyAnimation = async () => {
      if (!isHydrated) return

      try {
        const response = await fetch("/animations/cursor.json")
        const originalData = (await response.json()) as LottieJSON

        const isDarkMode = resolvedTheme === "dark"
        const modifiedData = modifyAnimationColors(originalData, isDarkMode)

        setAnimationData(modifiedData)
      } catch (error) {
        console.error("Failed to load and modify cursor animation:", error)
      }
    }

    loadAndModifyAnimation()
  }, [isHydrated, theme, resolvedTheme])

  if (!isHydrated || !enabled || !animationData) return null

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
      <LottieAnimation animationData={animationData} height={80} width={80} />
    </motion.div>
  )
}
