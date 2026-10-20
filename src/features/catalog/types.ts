import type { Meta, Paper, Stats } from "@/types/paper"

export type { Paper }

export interface CatalogSnapshot {
  papers: Paper[]
  meta: Meta
  stats: Stats
}

export interface CatalogResponse {
  meta: Meta & { papers: Paper[] }
  lastUpdated: Stats["lastUpdated"]
  stats: Stats
}

export type PaperSummary = Pick<
  Paper,
  "fileName" | "url" | "year" | "examType" | "subject" | "standardSubject"
>

export function toPaperSummary(paper: Paper): PaperSummary {
  return {
    fileName: paper.fileName,
    url: paper.url,
    year: paper.year,
    examType: paper.examType,
    subject: paper.subject,
    standardSubject: paper.standardSubject,
  }
}
