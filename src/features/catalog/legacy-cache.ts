import { removeStorage } from "@/lib/browser-storage"

export const LEGACY_CATALOG_KEYS = [
  "pyq_papers_data_v2",
  "pyq_papers_data",
  "pyqs_redirect_after_load",
] as const

export function removeLegacyCatalogCache(): void {
  LEGACY_CATALOG_KEYS.forEach(removeStorage)
}
