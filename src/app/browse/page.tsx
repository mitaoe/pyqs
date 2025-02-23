'use client';

import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import DirectoryBrowser from '@/components/directory/DirectoryBrowser';

const BASE_URL = 'http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/';

export default function BrowsePage() {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // TODO: Implement directory fetching
  const handleNavigate = (path: string) => {
    // This will be implemented with the crawler
    console.log('Navigating to:', path);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-content">Browse Papers</h1>
        </div>

        <DirectoryBrowser
          items={items}
          currentPath={currentPath}
          onNavigate={handleNavigate}
        />
      </div>
    </Layout>
  );
} 