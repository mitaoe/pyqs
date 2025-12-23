'use client';

import { createContext, useContext, useState, useRef, useEffect, type ReactNode, useCallback } from 'react';

interface ServerStatusContextType {
  isServerDown: boolean;
  isChecking: boolean;
  consecutiveFailures: number;
  checkServerStatus: () => Promise<boolean>;
  recordFailure: () => void;
  resetStatus: () => void;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export function useServerStatus() {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error('useServerStatus must be used within a ServerStatusProvider');
  }
  return context;
}

interface ServerStatusProviderProps {
  children: ReactNode;
}

const FAILURE_THRESHOLD = 1; // Show banner after 1 failure

export function ServerStatusProvider({ children }: ServerStatusProviderProps) {
  const [isServerDown, setIsServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCheckRef = useRef<number>(0);
  const hasInitialCheckRef = useRef(false);
  const hasAutoRecheckedRef = useRef(false);

  const checkServerStatus = useCallback(async (isAutoRecheck = false): Promise<boolean> => {
    // If already checking, wait for that check to complete
    if (isChecking) {
      return !isServerDown;
    }

    // Prevent duplicate checks within 2 seconds (skip for auto-recheck)
    const now = Date.now();
    if (!isAutoRecheck && now - lastCheckRef.current < 2000) {
      return !isServerDown;
    }
    lastCheckRef.current = now;

    setIsChecking(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/server-status', {
        signal: abortControllerRef.current.signal,
      });
      const data = await response.json();
      
      if (data.isAvailable) {
        // Server is up - reset everything
        setIsServerDown(false);
        setConsecutiveFailures(0);
        hasAutoRecheckedRef.current = false; // Reset for next time
        return true;
      } else {
        // Server is down
        setIsServerDown(true);
        return false;
      }
    } catch (error: unknown) {
      // Only handle non-abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to check server status:', error);
        setIsServerDown(true);
        return false;
      }
      return !isServerDown;
    } finally {
      setIsChecking(false);
      abortControllerRef.current = null;
    }
  }, [isServerDown, isChecking]);

  const recordFailure = useCallback(() => {
    setConsecutiveFailures((prev) => prev + 1);
  }, []);

  // Trigger server check when failures cross threshold
  useEffect(() => {
    if (consecutiveFailures >= FAILURE_THRESHOLD && !isServerDown) {
      checkServerStatus();
    }
  }, [consecutiveFailures, isServerDown, checkServerStatus]);

  const resetStatus = useCallback(() => {
    setIsServerDown(false);
    setConsecutiveFailures(0);
    hasAutoRecheckedRef.current = false;
  }, []);

  // Check server status on initial mount
  useEffect(() => {
    if (!hasInitialCheckRef.current) {
      hasInitialCheckRef.current = true;
      checkServerStatus();
    }
  }, [checkServerStatus]);

  // Auto-recheck once when banner first appears
  useEffect(() => {
    if (isServerDown && !hasAutoRecheckedRef.current && !isChecking) {
      hasAutoRecheckedRef.current = true;
      // Small delay before auto-recheck so user sees the banner first
      const timer = setTimeout(() => {
        checkServerStatus(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isServerDown, isChecking, checkServerStatus]);

  return (
    <ServerStatusContext.Provider 
      value={{ 
        isServerDown, 
        isChecking, 
        consecutiveFailures,
        checkServerStatus, 
        recordFailure,
        resetStatus
      }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
}
