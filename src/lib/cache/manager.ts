import { CacheManager, CacheConfig, CacheStats, PdfCacheEntry } from './types';
import { getCacheDatabase } from './database';

// Default settings
const DEFAULT_CONFIG: CacheConfig = {
  maxStorageSize: 200, // 200MB
  cacheDuration: 8760 // 1 year 
};

// PDF cache manager
export class SimpleCacheManager implements CacheManager {
  private db = getCacheDatabase();
  private config = DEFAULT_CONFIG;

  // Generate simple ID from URL
  private generateId(url: string): string {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  // Check if PDF is expired
  private isExpired(entry: PdfCacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.cachedAt.getTime() + (this.config.cacheDuration * 60 * 60 * 1000);
    return now > expiresAt;
  }

  // Store PDF in cache
  async storePdf(url: string, data: ArrayBuffer, fileName: string, subject: string, year: string): Promise<void> {
    try {
      // Check if we need to free up space first
      const stats = await this.getCacheStats();
      const maxBytes = this.config.maxStorageSize * 1024 * 1024;

      if (stats.totalSize + data.byteLength > maxBytes) {
        await this.cleanupOldPdfs(data.byteLength);
      }

      const entry: PdfCacheEntry = {
        id: this.generateId(url),
        url,
        fileName,
        data,
        subject,
        year,
        cachedAt: new Date(),
        lastAccessed: new Date(),
        size: data.byteLength
      };

      await this.db.storePdf(entry);
    } catch (error) {
      console.error('Cache store failed:', error);
    }
  }

  // Get PDF from cache
  async getPdf(url: string): Promise<ArrayBuffer | null> {
    try {
      const entry = await this.db.getPdf(url);

      if (!entry) return null;

      // Check if expired
      if (this.isExpired(entry)) {
        await this.db.deletePdf(entry.id);
        return null;
      }

      // Update last accessed time
      entry.lastAccessed = new Date();
      await this.db.storePdf(entry);

      return entry.data;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  // Clear all cached PDFs
  async clearAllCache(): Promise<void> {
    try {
      await this.db.clearAll();
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<CacheStats> {
    try {
      const allPdfs = await this.db.getAllPdfs();

      let totalSize = 0;
      for (const pdf of allPdfs) {
        totalSize += pdf.size;
      }

      const maxBytes = this.config.maxStorageSize * 1024 * 1024;

      return {
        totalSize,
        totalPapers: allPdfs.length,
        availableSpace: Math.max(0, maxBytes - totalSize)
      };
    } catch (error) {
      console.error('Cache stats failed:', error);
      return {
        totalSize: 0,
        totalPapers: 0,
        availableSpace: this.config.maxStorageSize * 1024 * 1024
      };
    }
  }

  // Clean up old PDFs to make space
  private async cleanupOldPdfs(requiredSpace: number): Promise<void> {
    try {
      const allPdfs = await this.db.getAllPdfs();

      // Sort by last accessed (oldest first)
      allPdfs.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      let freedSpace = 0;
      for (const pdf of allPdfs) {
        if (freedSpace >= requiredSpace) break;

        await this.db.deletePdf(pdf.id);
        freedSpace += pdf.size;
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  // Format bytes for display
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Singleton instance
let cacheManager: SimpleCacheManager | null = null;

export function getCacheManager(): SimpleCacheManager {
  if (!cacheManager) {
    cacheManager = new SimpleCacheManager();
  }
  return cacheManager;
}