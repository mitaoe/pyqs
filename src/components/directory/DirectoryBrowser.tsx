import { useState } from 'react';
import { FolderIcon, ArrowLeftIcon, DownloadIcon } from '@/components/ui/icons';
import { downloadFile } from '@/utils/download';
import type { DirectoryMeta } from '@/types/paper';

interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  path: string;
  metadata?: {
    fileName: string;
    url: string;
    year: string;
    branch: string;
    semester: string;
    examType: string;
    subject?: string;
  };
}

interface DirectoryBrowserProps {
  items: DirectoryItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  meta: DirectoryMeta;
}

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const parts = path.split('/').filter(Boolean);
  
  return (
    <div className="flex select-none items-center gap-2 text-sm">
      <button 
        onClick={() => onNavigate('')}
        className="text-content/60 hover:text-white"
      >
        root
      </button>
      {parts.map((part, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-content/40">/</span>
          <button
            onClick={() => onNavigate(parts.slice(0, index + 1).join('/'))}
            className="text-content/60 hover:text-white"
          >
            {part}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DirectoryBrowser({ 
  items, 
  currentPath, 
  onNavigate,
  meta 
}: DirectoryBrowserProps) {
  const directories = items.filter(item => item.isDirectory);
  const files = items.filter(item => !item.isDirectory);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleDownload = async (url: string, fileName: string) => {
    if (downloadingFile) return;
    
    setDownloadingFile(fileName);
    try {
      await downloadFile(url, fileName);
    } finally {
      setDownloadingFile(null);
    }
  };

  const preventRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex select-none flex-col space-y-6">
      <div className="sticky top-0 z-10 bg-primary">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-content">Browse Papers</h1>
          {currentPath && (
            <button
              onClick={() => onNavigate('../')}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-accent/90"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-accent bg-secondary">
        <div className="sticky top-0 z-10 border-b border-accent bg-secondary p-4">
          <Breadcrumb path={currentPath} onNavigate={onNavigate} />
        </div>

        {meta && (
          <div className="sticky top-[72px] z-10 border-b border-accent bg-secondary p-4">
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              {meta.years.length > 0 && (
                <div>
                  <span className="text-content/60">Years:</span>
                  <div className="mt-1 text-content">{meta.years.join(', ')}</div>
                </div>
              )}
              {meta.branches.length > 0 && (
                <div>
                  <span className="text-content/60">Branches:</span>
                  <div className="mt-1 text-content">{meta.branches.join(', ')}</div>
                </div>
              )}
              {meta.examTypes.length > 0 && (
                <div>
                  <span className="text-content/60">Exam Types:</span>
                  <div className="mt-1 text-content">{meta.examTypes.join(', ')}</div>
                </div>
              )}
              {meta.semesters.length > 0 && (
                <div>
                  <span className="text-content/60">Semesters:</span>
                  <div className="mt-1 text-content">{meta.semesters.join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
          <div className="divide-y divide-accent">
            {directories.map((item) => (
              <div
                key={item.path}
                className="flex items-center justify-between p-3 transition-colors hover:bg-accent/10"
                onContextMenu={preventRightClick}
              >
                <button
                  onClick={() => onNavigate(item.path)}
                  className="flex items-center gap-3 text-content transition-colors hover:text-white"
                >
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-sm">{item.name}</span>
                </button>
              </div>
            ))}

            {files.map((item) => (
              <div
                key={item.path}
                className="flex flex-col p-3 transition-colors hover:bg-accent/10"
                onContextMenu={preventRightClick}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-content">{item.name}</span>
                  </div>
                  {item.metadata && (
                    <button
                      onClick={() => handleDownload(item.metadata!.url, item.metadata!.fileName)}
                      disabled={downloadingFile === item.metadata.fileName}
                      className="flex items-center gap-2 rounded-md bg-accent/90 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <DownloadIcon className={`h-4 w-4 ${downloadingFile === item.metadata.fileName ? 'animate-spin' : ''}`} />
                      <span>{downloadingFile === item.metadata.fileName ? 'Downloading...' : 'Download'}</span>
                    </button>
                  )}
                </div>
                {item.metadata && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(item.metadata).map(([key, value]) => {
                      if (key === 'url' || key === 'fileName') return null;
                      if (!value) return null;
                      return (
                        <span
                          key={key}
                          className="rounded-full bg-primary/50 px-2 py-0.5 text-xs text-content/80"
                        >
                          {key}: {value}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 