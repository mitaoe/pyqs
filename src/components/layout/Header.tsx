import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent bg-secondary">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link 
            href="/" 
            className="text-xl font-bold tracking-tight text-content hover:text-white"
          >
            PYQs
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/years" 
              className="text-sm font-medium text-content hover:text-white"
            >
              By Year
            </Link>
            <Link 
              href="/subjects" 
              className="text-sm font-medium text-content hover:text-white"
            >
              By Subject
            </Link>
            <Link 
              href="/recent" 
              className="text-sm font-medium text-content hover:text-white"
            >
              Recent
            </Link>
            <Link 
              href="/browse" 
              className="text-sm font-medium text-content/60 hover:text-white"
            >
              Directory →
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 