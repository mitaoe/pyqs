import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent bg-secondary">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-xl font-bold tracking-tight text-content hover:text-white"
            >
              MITAOE PYQs
            </Link>
          </div>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/browse" 
              className="text-sm font-medium text-content hover:text-white"
            >
              Browse Directory
            </Link>
            <Link 
              href="/papers" 
              className="text-sm font-medium text-content hover:text-white"
            >
              Search Papers
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 