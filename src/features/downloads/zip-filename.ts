import type { PaperFilters } from "@/features/catalog/papers"
import type { DownloadablePaper } from "./types"

export function formatZipFilename(
  papers: Pick<DownloadablePaper, "standardSubject" | "subject">[],
  filters: Partial<PaperFilters>,
): string {
  if (!papers || papers.length === 0) {
    return "MITAoE_Papers.zip"
  }

  const subject = papers[0]?.standardSubject || papers[0]?.subject || ""
  const sanitizedSubject = subject.replace(/\s+/g, "_")

  let filename = sanitizedSubject ? `${sanitizedSubject}_Papers` : "MITAoE_Papers"

  if (filters.years?.length) {
    filename += `_${filters.years.join("-")}`
  }

  if (filters.examTypes?.length) {
    filename += `_${filters.examTypes.join("-")}`
  }

  return `${filename}.zip`
}

export function zipEntryName(fileName: string): string {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`
}
