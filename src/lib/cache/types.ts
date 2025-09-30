// Simple cache configuration
export interface CacheConfig {
  maxStorageSize: number; // in MB (default: 200MB)
  cacheDuration: number; // in hours (default: 1 year)
}

// Simple cache statistics
export interface CacheStats {
  totalSize: number; // in bytes
  totalPapers: number;
  availableSpace: number; // in bytes
}

// Simple PDF cache entry
export interface PdfCacheEntry {
  id: string; // hash of PDF URL
  url: string;
  fileName: string;
  data: ArrayBuffer; // The actual PDF file
  subject: string;
  year: string;
  cachedAt: Date;
  lastAccessed: Date;
  size: number;
}

// Simple cache manager interface
export interface CacheManager {
  storePdf(url: string, data: ArrayBuffer, fileName: string, subject: string, year: string): Promise<void>;
  getPdf(url: string): Promise<ArrayBuffer | null>;
  clearAllCache(): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
}