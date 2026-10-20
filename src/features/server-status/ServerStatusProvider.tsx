"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { PDF_BASE_URL } from "@/config/urls"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const CHECK_TIMEOUT_MS = 5000
const FAILURE_RECHECK_INTERVAL_MS = 2000
const AUTO_RECHECK_DELAY_MS = 500

interface ServerStatusContextType {
  isServerDown: boolean
  isChecking: boolean
  checkServerStatus: () => Promise<boolean>
  recordFailure: () => void
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined)

export function useServerStatus() {
  const context = useContext(ServerStatusContext)
  if (!context) {
    throw new Error("useServerStatus must be used within a ServerStatusProvider")
  }
  return context
}

export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const [isServerDown, setIsServerDown] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const isServerDownRef = useRef(false)
  const lastCheckRef = useRef(0)
  const autoRecheckedRef = useRef(false)

  const checkServerStatus = useCallback((): Promise<boolean> => {
    if (inFlightRef.current) return inFlightRef.current

    lastCheckRef.current = Date.now()
    setIsChecking(true)

    inFlightRef.current = fetchWithTimeout(
      PDF_BASE_URL,
      { method: "HEAD", mode: "cors" },
      CHECK_TIMEOUT_MS,
    )
      .then(
        (response) => response.ok,
        (error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return !isServerDownRef.current
          console.error("Failed to check server status:", error)
          return false
        },
      )
      .then((isUp) => {
        isServerDownRef.current = !isUp
        setIsServerDown(!isUp)
        if (isUp) autoRecheckedRef.current = false
        return isUp
      })
      .finally(() => {
        inFlightRef.current = null
        setIsChecking(false)
      })

    return inFlightRef.current
  }, [])

  const recordFailure = useCallback(() => {
    const recentlyChecked = Date.now() - lastCheckRef.current < FAILURE_RECHECK_INTERVAL_MS
    if (!isServerDownRef.current && !recentlyChecked) void checkServerStatus()
  }, [checkServerStatus])

  useEffect(() => {
    void checkServerStatus()
  }, [checkServerStatus])

  useEffect(() => {
    if (!isServerDown || autoRecheckedRef.current) return
    const timer = setTimeout(() => {
      autoRecheckedRef.current = true
      void checkServerStatus()
    }, AUTO_RECHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isServerDown, checkServerStatus])

  return (
    <ServerStatusContext.Provider
      value={{ isServerDown, isChecking, checkServerStatus, recordFailure }}
    >
      {children}
    </ServerStatusContext.Provider>
  )
}
