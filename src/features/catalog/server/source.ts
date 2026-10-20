import type { Paper } from "@/types/paper"
import type { CatalogSnapshot } from "../types"

export interface CatalogSource {
  readSubjectNames(): Promise<string[]>
  readSubjectPapers(subject: string): Promise<Paper[]>
  readSnapshot(): Promise<CatalogSnapshot>
}

export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CatalogUnavailableError"
  }
}
