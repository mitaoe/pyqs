import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-xl font-bold tracking-tight hover:text-gray-600"
            >
              MITAOE PYQs
            </Link>
          </div>
          
          <nav className="flex items-center gap-4">
            <Link 
              href="/papers" 
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Papers
            </Link>
            <Link 
              href="/about" 
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 