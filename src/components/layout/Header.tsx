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
          
        </div>
      </div>
    </header>
  );
} 