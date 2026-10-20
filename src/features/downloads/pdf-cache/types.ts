export interface CacheConfig {
  maxStorageMb: number
  cacheDurationHours: number
}

export interface CacheStats {
  totalSizeBytes: number
  totalPapers: number
  availableSpaceBytes: number
}

export interface PdfCacheEntry {
  id: string
  url: string
  fileName: string
  data: ArrayBuffer
  subject: string
  year: string
  cachedAt: Date
  lastAccessed: Date
  size: number
}

export interface CacheManager {
  storePdf(
    url: string,
    data: ArrayBuffer,
    fileName: string,
    subject: string,
    year: string,
  ): Promise<void>
  getPdf(url: string): Promise<ArrayBuffer | null>
  clearAllCache(): Promise<void>
  getCacheStats(): Promise<CacheStats>
}
