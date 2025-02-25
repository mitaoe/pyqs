'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DirectoryStructure, DirectoryMeta } from '@/types/paper';
import { STANDARD_VALUES } from '@/config/mappings';

interface PaperContextType {
  structure: DirectoryStructure | null;
  meta: DirectoryMeta | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: Error | null;
  standardValues: typeof STANDARD_VALUES;
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
  const [structure, setStructure] = useState<DirectoryStructure | null>(null);
  const [meta, setMeta] = useState<DirectoryMeta | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async (force = false) => {
    try {
      // Check cache first
      if (!force && typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_DURATION) {
            setStructure(data.structure);
            setMeta(data.meta);
            setLastUpdated(new Date(data.lastUpdated));
            setIsLoading(false);
            return;
          }
        }
      }

      const response = await fetch('/api/papers');
      if (!response.ok) throw new Error('Failed to fetch papers');
      
      const data = await response.json();
      
      // Update state
      setStructure(data.structure);
      setMeta(data.meta);
      setLastUpdated(new Date(data.lastUpdated));
      setError(null);

      // Cache the response
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    await fetchData(true); // Force refresh
  };

  const value = {
    structure,
    meta,
    lastUpdated,
    isLoading,
    error,
    standardValues: STANDARD_VALUES,
    refreshData
  };

  return (
    <PaperContext.Provider value={value}>
      {children}
    </PaperContext.Provider>
  );
} 