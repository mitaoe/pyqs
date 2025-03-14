'use client';

import { useEffect, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';

interface LoadingDataCheckerProps {
  children: ReactNode;
}

// Key for storing the original URL the user was attempting to visit
const ORIGINAL_URL_KEY = 'pyqs_redirect_after_load';

export default function LoadingDataChecker({ 
  children
}: LoadingDataCheckerProps) {
  const { prefetchData, dataReady, isLoading } = usePapers();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // /browse is exempt as it loads its own data on demand
  const isPapersPage = pathname === '/papers';
  
  useEffect(() => {
    // Helper to get full current URL including search params
    const getCurrentUrl = () => {
      const fullUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      return fullUrl;
    };

    // Check if we're on the homepage after being redirected
    const checkAndRedirect = () => {
      if (pathname === '/' && dataReady) {
        try {
          const redirectUrl = localStorage.getItem(ORIGINAL_URL_KEY);
          if (redirectUrl && redirectUrl !== '/') {
            localStorage.removeItem(ORIGINAL_URL_KEY);
            router.push(redirectUrl);
          }
        } catch (error) {
          console.error('Failed to restore original URL:', error);
        }
      }
    };
    
    // If we're on the papers page but data isn't ready, save URL and redirect to home
    if (isPapersPage && !dataReady && !isLoading) {
      try {
        localStorage.setItem(ORIGINAL_URL_KEY, getCurrentUrl());
      } catch (error) {
        console.error('Failed to save original URL:', error);
      }
      router.push('/');
    }
    
    // If we're on the homepage and data isn't ready, start prefetching papers data
    if (pathname === '/' && !dataReady && !isLoading) {
      prefetchData();
    }
    
    // Check if we should redirect back to original URL after data is loaded
    checkAndRedirect();
    
  }, [pathname, searchParams, dataReady, isLoading, router, prefetchData, isPapersPage]);
  
  return <>{children}</>;
} 