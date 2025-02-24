'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import DirectoryBrowser from '@/components/directory/DirectoryBrowser';
import { usePapers } from '@/contexts/PaperContext';
import type { DirectoryNode } from '@/types/paper';

function getCurrentNode(structure: DirectoryNode, path: string): DirectoryNode | null {
  if (!path) return structure;
  
  const parts = path.split('/').filter(Boolean);
  let current = structure;

  for (const part of parts) {
    const child = current.children[part];
    if (!child) return null;
    current = child;
  }

  return current;
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';
  
  const { structure, isLoading, error } = usePapers();
  const [currentNode, setCurrentNode] = useState<DirectoryNode | null>(null);

  useEffect(() => {
    if (structure) {
      setCurrentNode(getCurrentNode(structure, currentPath));
    }
  }, [structure, currentPath]);

  const handleNavigate = (path: string) => {
    if (path === '../') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const newPath = parts.join('/');
      router.push(`/browse${newPath ? `?path=${newPath}` : ''}`);
    } else {
      router.push(`/browse?path=${path}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-content/60">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
        {error.message}
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="rounded-lg border border-accent bg-secondary p-8 text-center text-content/60">
        Directory not found
      </div>
    );
  }

  const items = Object.entries(currentNode.children).map(([name, node]) => ({
    name,
    isDirectory: node.type === 'directory',
    path: node.path,
    metadata: node.metadata
  }));

  return (
    <div className="space-y-6">

      <DirectoryBrowser
        items={items}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        meta={currentNode.meta}
      />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Layout>
      <BrowseContent />
    </Layout>
  );
} 