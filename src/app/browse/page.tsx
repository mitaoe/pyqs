'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';

interface Paper {
  name: string;
  downloadUrl: string;
  year: string;
  branch: string;
  semester: string;
  examType: string;
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';

  const [directories, setDirectories] = useState<string[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDirectory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/browse?path=${encodeURIComponent(currentPath)}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setDirectories(data.directories);
        setPapers(data.papers);
      } catch (error) {
        console.error('Failed to fetch directory:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch directory');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectory();
  }, [currentPath]);

  const handleNavigate = (dir: string) => {
    const newPath = currentPath ? `${currentPath}/${dir}` : dir;
    router.push(`/browse?path=${encodeURIComponent(newPath)}`);
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/');
    router.push(`/browse?path=${encodeURIComponent(newPath)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-content">Browse Papers</h1>
        {currentPath && (
          <button
            onClick={handleBack}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-content transition-colors hover:text-white"
          >
            Back
          </button>
        )}
      </div>

      <div className="text-sm text-content/60">
        Current path: {currentPath || '/'}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-content/60">Loading...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {directories.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium text-content">Directories</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => handleNavigate(dir)}
                    className="flex items-center gap-2 rounded-lg border border-accent bg-secondary p-3 text-left transition-colors hover:bg-accent"
                  >
                    <FolderIcon className="h-5 w-5 text-content/60" />
                    <span className="text-sm text-content">{dir}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {papers.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium text-content">Papers</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {papers.map((paper) => (
                  <div
                    key={paper.downloadUrl}
                    className="rounded-lg border border-accent bg-secondary p-4"
                  >
                    <div className="mb-3 space-y-1">
                      <h3 className="font-medium text-content">{paper.name}</h3>
                      <div className="text-xs text-content/60">
                        {paper.branch} • {paper.semester} • {paper.examType}
                      </div>
                    </div>
                    <a
                      href={paper.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-content transition-colors hover:text-white"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {directories.length === 0 && papers.length === 0 && (
            <div className="rounded-lg border border-accent bg-secondary p-8 text-center text-content/60">
              No items found in this directory
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-content/60">Loading...</div>
        </div>
      }>
        <BrowseContent />
      </Suspense>
    </Layout>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
} 