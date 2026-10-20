export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export function subjectHref(subject: string): string {
  return `/papers?subject=${encodeURIComponent(subject)}`
}

export function subjectPath(subject: string): string {
  return `/papers/${subject.split("/").map(encodeURIComponent).join("/")}`
}

export function decodeSubjectParam(param: string): string {
  try {
    return decodeURIComponent(param)
  } catch {
    return param
  }
}

export function resolveSubject(subjects: string[], name: string): string | null {
  const wanted = name.toLowerCase()
  return subjects.find((subject) => subject.toLowerCase() === wanted) ?? null
}

export function searchSubjects(subjects: string[], query: string, limit: number = 10): string[] {
  if (!subjects.length || !query.trim()) {
    return []
  }

  const searchTerm = query.toLowerCase()

  return subjects
    .filter((subject) => subject.toLowerCase().includes(searchTerm))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(searchTerm)
      const bStartsWith = b.toLowerCase().startsWith(searchTerm)

      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1

      return a.localeCompare(b)
    })
    .slice(0, limit)
}

export function groupSubjectsByLetter(subjects: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  subjects.forEach((subject) => {
    const firstLetter = subject.charAt(0).toUpperCase()
    if (!grouped[firstLetter]) {
      grouped[firstLetter] = []
    }
    if (!grouped[firstLetter].includes(subject)) {
      grouped[firstLetter].push(subject)
    }
  })

  Object.keys(grouped).forEach((letter) => {
    grouped[letter].sort()
  })

  return grouped
}

export function getAvailableLetters(subjects: string[]): Set<string> {
  return new Set(subjects.map((subject) => subject.charAt(0).toUpperCase()))
}

export function getHighlightedText(
  text: string,
  query: string,
): { prefix: string; highlight: string; suffix: string } {
  if (!query) {
    return { prefix: text, highlight: "", suffix: "" }
  }

  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) {
    return { prefix: text, highlight: "", suffix: "" }
  }

  return {
    prefix: text.substring(0, index),
    highlight: text.substring(index, index + query.length),
    suffix: text.substring(index + query.length),
  }
}
