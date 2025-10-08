import { PdfCacheEntry } from './types';

// Database configuration
export const DB_NAME = 'mitaoe-pyqs-cache';
export const DB_VERSION = 1;
export const STORE_NAME = 'pdfs';

// Database connection class
export class CacheDatabase {
    private db: IDBDatabase | null = null;

    // Get database connection
    async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(new Error('Failed to open database'));
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create simple PDF store
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('url', 'url');
                    store.createIndex('lastAccessed', 'lastAccessed');
                }
            };
        });
    }

    // Store PDF
    async storePdf(entry: PdfCacheEntry): Promise<void> {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to store PDF'));
        });
    }

    // Get PDF by URL
    async getPdf(url: string): Promise<PdfCacheEntry | null> {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('url');

        return new Promise((resolve, reject) => {
            const request = index.get(url);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error('Failed to get PDF'));
        });
    }

    // Get all PDFs
    async getAllPdfs(): Promise<PdfCacheEntry[]> {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error('Failed to get all PDFs'));
        });
    }

    // Delete PDF
    async deletePdf(id: string): Promise<void> {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to delete PDF'));
        });
    }

    // Clear all PDFs
    async clearAll(): Promise<void> {
        const db = await this.getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to clear cache'));
        });
    }
}

// Singleton instance
let dbInstance: CacheDatabase | null = null;

export function getCacheDatabase(): CacheDatabase {
    if (!dbInstance) {
        dbInstance = new CacheDatabase();
    }
    return dbInstance;
}