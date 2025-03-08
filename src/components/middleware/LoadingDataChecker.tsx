'use client';

import { useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';

interface LoadingDataCheckerProps {
  children: ReactNode;
}

export default function LoadingDataChecker({ 
  children
}: LoadingDataCheckerProps) {
  const { prefetchData, dataReady, isLoading } = usePapers();
  const router = useRouter();
  const pathname = usePathname();
  
  // /browse is exempt as it loads its own data on demand
  const isPapersPage = pathname === '/papers';
  
  useEffect(() => {
    // If we're on the papers page but data isn't ready, redirect to home
    if (isPapersPage && !dataReady && !isLoading) {
      router.push('/');
    }
    
    // If we're on the homepage and data isn't ready, start prefetching papers data
    if (pathname === '/' && !dataReady && !isLoading) {
      prefetchData();
    }
  }, [pathname, dataReady, isLoading, router, prefetchData, isPapersPage]);
  
  return <>{children}</>;
} 