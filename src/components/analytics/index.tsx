'use client';

import { Analytics } from '@vercel/analytics/react';
import { useEffect, useState } from 'react';

export default function AnalyticsWrapper() {
  const [mounted, setMounted] = useState(false);
  const [shouldTrack, setShouldTrack] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if this is the first visit
    const hasVisited = localStorage.getItem('hasVisitedBefore');
    
    if (!hasVisited) {
      // If first visit, set the flag and enable tracking
      localStorage.setItem('hasVisitedBefore', 'true');
      setShouldTrack(true);
    }
  }, []);

  if (!mounted) {
    return null;
  }

  if (!shouldTrack) {
    return null;
  }

  return <Analytics />;
} 