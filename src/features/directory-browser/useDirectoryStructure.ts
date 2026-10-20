"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { DirectoryNode } from "@/types/paper"

export function useDirectoryStructure() {
  const [structure, setStructure] = useState<DirectoryNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchDirectoryData = useCallback(async () => {
    if (isLoading) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/directory")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch directory structure")
      }

      const data = await response.json()
      setStructure(data.structure)
    } catch (err) {
      console.error("Failed to fetch directory data:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
      toast.error(err instanceof Error ? err.message : "Failed to fetch directory structure")
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  return { structure, isLoading, error, fetchDirectoryData }
}
