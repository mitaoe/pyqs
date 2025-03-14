'use client';

import { useEffect, useState, ReactNode } from 'react';
import GhostCursor from './animations/GhostCursor';

interface ClientProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
  enableGhost?: boolean;
}

export default function ClientProvider({ 
  children, 
  fallback = null,
  enableGhost = true
}: ClientProviderProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <>
      {isClient ? children : fallback}
      {enableGhost && <GhostCursor />}
    </>
  );
} 