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
  };
}

interface DirectoryBrowserProps {
  items: DirectoryItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  meta: DirectoryMeta;
}

export default function DirectoryBrowser({ 
  items, 
  currentPath, 
  onNavigate,
  meta 
}: DirectoryBrowserProps) {
  const directories = items.filter(item => item.isDirectory);
  const files = items.filter(item => !item.isDirectory);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-accent bg-secondary">
        <div className="border-b border-accent p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('../')}
              className="rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-content transition-colors hover:text-white"
            >
              ../
            </button>
            <code className="text-sm text-content">{currentPath || '/'}</code>
          </div>
        </div>

        {meta && (
          <div className="border-b border-accent p-4">
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
        
        <div className="divide-y divide-accent">
          {directories.map((item) => (
            <div
              key={item.path}
              className="flex items-center justify-between p-3 transition-colors hover:bg-accent"
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
              className="flex items-center justify-between p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3 text-content">
                <FileIcon className="h-4 w-4" />
                <div>
                  <div className="text-sm">{item.name}</div>
                  {item.metadata && (
                    <div className="mt-0.5 text-xs text-content/60">
                      {item.metadata.branch} • {item.metadata.semester} • {item.metadata.examType}
                    </div>
                  )}
                </div>
              </div>
              
              {item.metadata && (
                <a
                  href={item.metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-content transition-colors hover:text-white"
                >
                  Download
                </a>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-8 text-center text-content/60">
              No items in this directory
            </div>
          )}
        </div>
      </div>
    </div>
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

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
      />
    </svg>
  );
} 