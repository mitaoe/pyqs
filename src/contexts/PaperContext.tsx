'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { DirectoryStructure, DirectoryMeta } from '@/types/paper';

interface PaperContextType {
  structure: DirectoryStructure | null;
  meta: DirectoryMeta | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

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

  const fetchData = async () => {
    try {
      const response = await fetch('/api/papers');
      if (!response.ok) throw new Error('Failed to fetch papers');
      
      const data = await response.json();
      setStructure(data.structure);
      setMeta(data.meta);
      setLastUpdated(new Date(data.lastUpdated));
      setError(null);
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
    await fetchData();
  };

  const value = {
    structure,
    meta,
    lastUpdated,
    isLoading,
    error,
    refreshData
  };

  return (
    <PaperContext.Provider value={value}>
      {children}
    </PaperContext.Provider>
  );
} 