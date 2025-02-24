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

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
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
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-content transition-colors hover:text-white"
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
                className="flex items-center justify-between p-3 transition-colors hover:bg-accent"
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
                className="flex items-center justify-between p-3 transition-colors hover:bg-accent"
                onContextMenu={preventRightClick}
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
                  <button
                    onClick={() => handleDownload(item.metadata!.url, item.metadata!.fileName)}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-content transition-colors hover:text-white"
                    onContextMenu={preventRightClick}
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Download
                  </button>
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

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M10 19l-7-7m0 0l7-7m-7 7h18" 
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