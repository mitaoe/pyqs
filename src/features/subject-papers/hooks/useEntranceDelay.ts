"use client"

import { useEffect, useState } from "react"

export function useEntranceDelay(ms: number): boolean {
  const [isWaiting, setIsWaiting] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsWaiting(false), ms)
    return () => clearTimeout(timer)
  }, [ms])

  return isWaiting
}
