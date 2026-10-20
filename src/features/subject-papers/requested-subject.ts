import { decodeSubjectParam } from "@/features/catalog/subjects"

const SUBJECT_PATH_PREFIX = "/papers/"

export function requestedSubject(pathname: string, query: URLSearchParams): string | null {
  if (pathname === "/papers") return query.getAll("subject").at(-1) || null
  if (!pathname.startsWith(SUBJECT_PATH_PREFIX)) return null

  const subject = pathname
    .slice(SUBJECT_PATH_PREFIX.length)
    .split("/")
    .filter(Boolean)
    .map(decodeSubjectParam)
    .join("/")
  return subject || null
}
