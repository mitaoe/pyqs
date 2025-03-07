'use client';

import { createContext, useContext, useEffect, useState, useRef, type ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import type { DirectoryMeta, Paper } from '@/types/paper';
import { STANDARD_VALUES } from '@/config/mappings';

interface PaperContextType {
  meta: DirectoryMeta | null;
  papers: Paper[];
  structure: DirectoryNode | null;
  lastUpdated: Date | null;
  isLoading: boolean;
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
}

const CACHE_KEY = 'pyq_data';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

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

export function PaperProvider({ children }: PaperProviderProps) {
  const [meta, setMeta] = useState<DirectoryMeta | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [structure, setStructure] = useState<DirectoryNode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState({
    subject: '',
    year: '',
    branch: '',
    semester: '',
    examType: ''
  });
  const isMounted = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    try {
      // Only check cache if mounted (client-side) and not forcing refresh
      if (!force && isMounted.current) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < CACHE_DURATION) {
              setMeta(data.meta);
              setPapers(data.meta.papers || []);
              setStructure(data.structure);
              setLastUpdated(new Date(data.lastUpdated));
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to read from cache:', e);
          toast.error('Failed to load cached data');
        }
      }

      if (force) {
        toast.loading('Refreshing papers...');
      }

      // Build query string from filters
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });

      // Fetch both papers and directory structure
      const [papersResponse, directoryResponse] = await Promise.all([
        fetch(`/api/papers?${query}`),
        fetch('/api/directory')
      ]);
      
      if (!papersResponse.ok) {
        const errorData = await papersResponse.json();
        throw new Error(errorData.error || 'Failed to fetch papers');
      }

      if (!directoryResponse.ok) {
        const errorData = await directoryResponse.json();
        throw new Error(errorData.error || 'Failed to fetch directory structure');
      }
      
      const [papersData, directoryData] = await Promise.all([
        papersResponse.json(),
        directoryResponse.json()
      ]);

      // Update state with both papers and directory data
      setMeta(papersData.meta);
      setPapers(papersData.meta.papers || []);
      setStructure(directoryData.structure);
      setLastUpdated(new Date(papersData.lastUpdated));
      
      // Cache the combined data
      if (isMounted.current) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: {
              meta: papersData.meta,
              structure: directoryData.structure,
              lastUpdated: papersData.lastUpdated
            },
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Failed to cache data:', e);
          console.error('Cache error details:', e);
        }
      }

      if (force) {
        toast.success('Papers refreshed successfully');
      }
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      toast.error(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const setFilter = (key: keyof PaperContextType['filters'], value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (isMounted.current) {
      fetchData();
    }
  }, [fetchData]);

  return (
    <PaperContext.Provider value={{
      meta,
      papers,
      structure,
      lastUpdated,
      isLoading,
      error,
      standardValues: STANDARD_VALUES,
      filters,
      setFilter,
      refreshData: () => fetchData(true)
    }}>
      {children}
    </PaperContext.Provider>
  );
} 