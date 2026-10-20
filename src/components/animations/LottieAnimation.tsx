"use client"

import dynamic from "next/dynamic"
import { useIsHydrated } from "@/hooks/useIsHydrated"

const LottieSvg = dynamic(() => import("lottie-react").then((mod) => mod.LottieSvg), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-accent/20 rounded-lg h-full w-full" />,
})

interface LottieAnimationProps {
  animationData?: object
  animationName?: "loading" | "cursor"
  loop?: boolean
  autoplay?: boolean
  className?: string
  width?: number | string
  height?: number | string
  speed?: number
}

export default function LottieAnimation({
  animationData,
  animationName,
  loop = true,
  autoplay = true,
  className = "",
  width = "100%",
  height = "100%",
  speed = 1,
}: LottieAnimationProps) {
  const isHydrated = useIsHydrated()
  const src = animationData ?? (animationName ? `/animations/${animationName}.json` : null)

  if (!isHydrated || !src) {
    return (
      <div
        className="animate-pulse bg-accent/20 rounded-lg h-full w-full"
        style={{ width, height }}
      />
    )
  }

  return (
    <div className={className} style={{ width, height }}>
      <LottieSvg
        src={src}
        loop={loop}
        autoplay={autoplay}
        speed={speed}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
