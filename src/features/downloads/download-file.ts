import { toast } from "sonner"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getCacheManager } from "./pdf-cache/manager"
import { saveBlob } from "./save-blob"
import type { DownloadablePaper } from "./types"

export async function downloadFile(
  url: string,
  fileName: string,
  paper?: DownloadablePaper,
): Promise<boolean> {
  try {
    const cacheManager = getCacheManager()
    const cachedData = await cacheManager.getPdf(url)

    let blob: Blob

    if (cachedData) {
      blob = new Blob([cachedData], { type: "application/pdf" })
    } else {
      const response = await fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error("Download failed")
      }

      const contentDisposition = response.headers.get("content-disposition")
      const serverFileName = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/["']/g, "")
        : null

      if (serverFileName) {
        fileName = serverFileName
      }

      blob = await response.blob()

      if (paper) {
        try {
          const arrayBuffer = await blob.arrayBuffer()
          await cacheManager.storePdf(
            url,
            arrayBuffer,
            fileName,
            paper.subject || "Unknown",
            paper.year || "Unknown",
          )
        } catch (cacheError) {
          console.warn("Failed to cache downloaded file:", cacheError)
        }
      }
    }

    saveBlob(blob, fileName)
    return true
  } catch (error) {
    console.error("Download failed:", error)
    toast.error("Failed to download file. Please try again.")
    return false
  }
}
