import { CacheManager, CacheConfig, CacheStats, PdfCacheEntry } from "./types"
import { getCacheDatabase } from "./database"

const DEFAULT_CONFIG: CacheConfig = {
  maxStorageMb: 200,
  cacheDurationHours: 24 * 365,
}

const BYTES_PER_MB = 1024 * 1024
const MS_PER_HOUR = 60 * 60 * 1000

export class SimpleCacheManager implements CacheManager {
  private db = getCacheDatabase()
  private config = DEFAULT_CONFIG

  private get maxBytes(): number {
    return this.config.maxStorageMb * BYTES_PER_MB
  }

  private isExpired(entry: PdfCacheEntry): boolean {
    return Date.now() > entry.cachedAt.getTime() + this.config.cacheDurationHours * MS_PER_HOUR
  }

  async storePdf(
    url: string,
    data: ArrayBuffer,
    fileName: string,
    subject: string,
    year: string,
  ): Promise<void> {
    try {
      const stats = await this.getCacheStats()
      if (stats.totalSizeBytes + data.byteLength > this.maxBytes) {
        await this.evictLeastRecentlyUsed(data.byteLength)
      }

      await this.db.storePdf({
        id: url,
        url,
        fileName,
        data,
        subject,
        year,
        cachedAt: new Date(),
        lastAccessed: new Date(),
        size: data.byteLength,
      })
    } catch (error) {
      console.error("Cache store failed:", error)
    }
  }

  async getPdf(url: string): Promise<ArrayBuffer | null> {
    try {
      const entry = await this.db.getPdf(url)
      if (!entry) return null

      if (this.isExpired(entry)) {
        await this.db.deletePdf(entry.id)
        return null
      }

      entry.lastAccessed = new Date()
      await this.db.storePdf(entry)
      return entry.data
    } catch (error) {
      console.error("Cache get failed:", error)
      return null
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      await this.db.clearAll()
    } catch (error) {
      console.error("Cache clear failed:", error)
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const allPdfs = await this.db.getAllPdfs()
      const totalSizeBytes = allPdfs.reduce((sum, pdf) => sum + pdf.size, 0)

      return {
        totalSizeBytes,
        totalPapers: allPdfs.length,
        availableSpaceBytes: Math.max(0, this.maxBytes - totalSizeBytes),
      }
    } catch (error) {
      console.error("Cache stats failed:", error)
      return { totalSizeBytes: 0, totalPapers: 0, availableSpaceBytes: this.maxBytes }
    }
  }

  private async evictLeastRecentlyUsed(requiredBytes: number): Promise<void> {
    try {
      const allPdfs = await this.db.getAllPdfs()
      allPdfs.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime())

      let freedBytes = 0
      for (const pdf of allPdfs) {
        if (freedBytes >= requiredBytes) break
        await this.db.deletePdf(pdf.id)
        freedBytes += pdf.size
      }
    } catch (error) {
      console.error("Cache cleanup failed:", error)
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }
}

let cacheManager: SimpleCacheManager | null = null

export function getCacheManager(): SimpleCacheManager {
  cacheManager ??= new SimpleCacheManager()
  return cacheManager
}
