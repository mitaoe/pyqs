interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface DirectoryBrowserProps {
  items: DirectoryItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function DirectoryBrowser({ items, currentPath, onNavigate }: DirectoryBrowserProps) {
  return (
    <div className="rounded-lg border border-accent bg-secondary">
      <div className="border-b border-accent p-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('../')}
            className="rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-content transition-colors hover:text-white"
          >
            ../
          </button>
          <code className="text-sm text-content">{currentPath}</code>
        </div>
      </div>
      
      <div className="divide-y divide-accent">
        {items.map((item) => (
          <div
            key={item.path}
            className="flex items-center justify-between p-3 transition-colors hover:bg-accent"
          >
            <button
              onClick={() => onNavigate(item.path)}
              className="flex items-center gap-3 text-content transition-colors hover:text-white"
            >
              {item.isDirectory ? (
                <FolderIcon className="h-4 w-4" />
              ) : (
                <FileIcon className="h-4 w-4" />
              )}
              <span className="text-sm">{item.name}</span>
            </button>
            
            {!item.isDirectory && (
              <a
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-content transition-colors hover:text-white"
              >
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
} 