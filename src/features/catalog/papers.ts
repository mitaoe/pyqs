import type { Paper } from "@/types/paper"

type SubjectFields = Pick<Paper, "subject" | "standardSubject">
type FilterFields = Pick<Paper, "fileName" | "year" | "examType">

export interface PaperFilters {
  years: string[]
  examTypes: string[]
}

export const EMPTY_FILTERS: PaperFilters = { years: [], examTypes: [] }

export const EXAM_TYPE_OPTIONS = ["ESE", "MSE"] as const

export function matchesSubject(paper: SubjectFields, subject: string): boolean {
  const wanted = subject.toLowerCase()
  return paper.standardSubject.toLowerCase() === wanted || paper.subject.toLowerCase() === wanted
}

export function selectSubjectPapers<T extends SubjectFields>(papers: T[], subject: string): T[] {
  return papers.filter((paper) => matchesSubject(paper, subject))
}

export function normalizeExamType(examType: string): "ESE" | "MSE" {
  return examType.toLowerCase() === "mse" ? "MSE" : "ESE"
}

export function filterPapers<T extends FilterFields>(papers: T[], filters: PaperFilters): T[] {
  let filtered = [...papers]

  if (filters.years.length > 0) {
    filtered = filtered.filter((paper) => filters.years.includes(paper.year))
  }

  if (filters.examTypes.length > 0) {
    filtered = filtered.filter((paper) =>
      filters.examTypes.includes(normalizeExamType(paper.examType)),
    )
  }

  const sorted = [...filtered].sort((a, b) => {
    const yearA = parseInt(a.year) || 0
    const yearB = parseInt(b.year) || 0
    return yearB - yearA
  })

  return Array.from(new Map(sorted.map((paper) => [paper.fileName, paper])).values())
}

export function yearOptions(papers: Pick<Paper, "year">[]): string[] {
  const years = new Set<string>()
  papers.forEach((paper) => years.add(paper.year))
  return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))
}

export function hasActiveFilters(filters: PaperFilters): boolean {
  return filters.years.length > 0 || filters.examTypes.length > 0
}

export function toggleFilterValue(
  filters: PaperFilters,
  key: keyof PaperFilters,
  value: string,
): PaperFilters {
  const current = filters[key]
  return {
    ...filters,
    [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
  }
}
