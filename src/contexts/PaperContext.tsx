'use client';

import { createContext, useContext, useEffect, useState, useRef, type ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import type { DirectoryMeta, DirectoryNode, Paper } from '@/types/paper';
import { STANDARD_VALUES } from '@/config/mappings';
import { getCacheManager } from '@/lib/cache';

export enum LoadingStatus {
  IDLE = 'idle',
  METADATA_LOADING = 'metadata_loading',
  PAPERS_LOADING = 'papers_loading',
  DIRECTORY_LOADING = 'directory_loading',
  COMPLETE = 'complete',
  ERROR = 'error'
}

interface PaperContextType {
  meta: DirectoryMeta | null;
  papers: Paper[];
  structure: DirectoryNode | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  loadingStatus: LoadingStatus;
  dataReady: boolean;
  error: Error | null;
  standardValues: typeof STANDARD_VALUES;
  filters: {
    subject: string;
    year: string;
    branch: string;
    semester: string;
    examType: string;
  };
  setFilter: (key: keyof PaperContextType['filters'], value: string) => void;
  refreshData: () => Promise<void>;
  prefetchData: () => Promise<void>;
  fetchDirectoryData: () => Promise<void>;
  checkCacheStatus: (paper: Paper) => Promise<Paper>;
}

const PAPERS_CACHE_KEY = 'pyq_papers_data';
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // 1 week

const PaperContext = createContext<PaperContextType | undefined>(undefined);

export function usePapers() {
  const context = useContext(PaperContext);
  if (!context) {
    throw new Error('usePapers must be used within a PaperProvider');
  }
  return context;
}

interface PaperProviderProps {
  children: ReactNode;
}

interface StorableData {
  data: {
    meta: Record<string, unknown>;
    structure?: Record<string, unknown>;
    lastUpdated: string | Date;
    [key: string]: unknown;
  };
  timestamp: number;
  [key: string]: unknown;
}

function safeLocalStorage(key: string, data: StorableData): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e instanceof Error) {
      console.warn('Failed to cache data:', e.message);
    }
    return false;
  }
}

export function PaperProvider({ children }: PaperProviderProps) {
  const [meta, setMeta] = useState<DirectoryMeta | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [structure, setStructure] = useState<DirectoryNode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>(LoadingStatus.IDLE);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState({
    subject: '',
    year: '',
    branch: '',
    semester: '',
    examType: ''
  });
  const isMounted = useRef(false);
  const cacheManager = getCacheManager();

  // Lazy cache status checking - don't block UI with 5K lookups
  const checkPaperCacheStatus = useCallback(async (paper: Paper): Promise<Paper> => {
    try {
      const cachedData = await cacheManager.getPdf(paper.url);
      if (cachedData) {
        return {
          ...paper,
          cacheStatus: 'cached' as const,
          cacheSize: cachedData.byteLength,
          lastCached: new Date()
        };
      }
      return {
        ...paper,
        cacheStatus: 'not-cached' as const
      };
    } catch {
      return {
        ...paper,
        cacheStatus: 'not-cached' as const
      };
    }
  }, [cacheManager]);

  // Initialize papers without cache status - add it lazily when needed
  const initializePapers = useCallback((papers: Paper[]): Paper[] => {
    return papers.map(paper => ({
      ...paper,
      cacheStatus: 'not-cached' as const // Default assumption
    }));
  }, []);

  const fetchPapersData = useCallback(async (force = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      if (!force && isMounted.current) {
        setLoadingStatus(LoadingStatus.METADATA_LOADING);
        try {
          const cached = localStorage.getItem(PAPERS_CACHE_KEY);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age < CACHE_DURATION) {
              // Load cached metadata immediately - no expensive cache checks
              const initializedPapers = initializePapers(data.meta.papers || []);
              const initializedMeta = {
                ...data.meta,
                papers: initializedPapers
              };

              setMeta(initializedMeta);
              setPapers(initializedPapers);
              setLastUpdated(new Date(data.lastUpdated));
              setLoadingStatus(LoadingStatus.COMPLETE);
              setDataReady(true);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          console.warn('Failed to read from cache');
        }
      }

      if (force) {
        toast.loading('Refreshing papers...');
      }

      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });

      setLoadingStatus(LoadingStatus.PAPERS_LOADING);
      const papersResponse = await fetch(`/api/papers?${query}`);

      if (!papersResponse.ok) {
        const errorData = await papersResponse.json();
        throw new Error(errorData.error || 'Failed to fetch papers');
      }

      const papersData = await papersResponse.json();

      // Initialize papers without expensive cache checks - UI loads fast
      const initializedPapers = initializePapers(papersData.meta.papers || []);

      setMeta({
        ...papersData.meta,
        papers: initializedPapers
      });
      setPapers(initializedPapers);
      setLastUpdated(new Date(papersData.lastUpdated));

      if (isMounted.current) {
        const cacheData = {
          data: {
            meta: {
              ...papersData.meta,
              papers: initializedPapers
            },
            lastUpdated: papersData.lastUpdated
          },
          timestamp: Date.now()
        };

        safeLocalStorage(PAPERS_CACHE_KEY, cacheData);
      }

      if (force) {
        toast.success('Papers refreshed successfully');
      }

      setLoadingStatus(LoadingStatus.COMPLETE);
      setDataReady(true);

    } catch (error) {
      console.error('Failed to fetch papers data:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      setLoadingStatus(LoadingStatus.ERROR);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch papers data');
    } finally {
      setIsLoading(false);
    }
  }, [filters, isLoading, initializePapers]);

  const fetchDirectoryData = useCallback(async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setLoadingStatus(LoadingStatus.DIRECTORY_LOADING);

      // We never cache directory structure - it's only for developer use
      const directoryResponse = await fetch('/api/directory');

      if (!directoryResponse.ok) {
        const errorData = await directoryResponse.json();
        throw new Error(errorData.error || 'Failed to fetch directory structure');
      }

      const directoryData = await directoryResponse.json();
      setStructure(directoryData.structure);

      setLoadingStatus(LoadingStatus.COMPLETE);
    } catch (error) {
      console.error('Failed to fetch directory data:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      setLoadingStatus(LoadingStatus.ERROR);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch directory structure');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const prefetchData = useCallback(async () => {
    // Don't prefetch if data is already ready or already loading
    if (dataReady || isLoading) return;
    await fetchPapersData(false);
  }, [dataReady, isLoading, fetchPapersData]);

  const setFilter = (key: keyof PaperContextType['filters'], value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (isMounted.current && Object.values(filters).some(v => v)) {
      fetchPapersData(false);
    }
  }, [filters, fetchPapersData]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <PaperContext.Provider value={{
      meta,
      papers,
      structure,
      lastUpdated,
      isLoading,
      loadingStatus,
      dataReady,
      error,
      standardValues: STANDARD_VALUES,
      filters,
      setFilter,
      refreshData: () => fetchPapersData(true),
      prefetchData,
      fetchDirectoryData,
      checkCacheStatus: checkPaperCacheStatus
    }}>
      {children}
    </PaperContext.Provider>
  );
} 