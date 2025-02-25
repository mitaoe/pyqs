'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
      const node = getCurrentNode(structure, currentPath);
      setCurrentNode(node);
      
      if (!node && currentPath) {
        toast.error('Directory not found');
      } else if (node && currentPath) {
        const parts = currentPath.split('/').filter(Boolean);
        toast.success(`Navigated to ${parts[parts.length - 1]}`);
      }
    }
  }, [structure, currentPath]);

  const handleNavigate = (path: string) => {
    if (path === '../') {
      const parts = currentPath.split('/').filter(Boolean);
      const parentName = parts[parts.length - 2] || 'root';
      parts.pop();
      const newPath = parts.join('/');
      router.push(`/browse${newPath ? `?path=${newPath}` : ''}`);
      toast.info(`Navigated back to ${parentName}`);
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
    toast.error(error.message);
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

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-content/60">Loading directory...</div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <BrowseContent />
      </Suspense>
    </Layout>
  );
} 