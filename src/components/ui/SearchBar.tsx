import { useEffect, useState } from 'react';
import { SearchIcon } from './icons';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ 
  value,
  onSearch, 
  placeholder = "Search papers..." 
}: SearchBarProps) {
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== value) {
        onSearch(query);
      }
    }, 300); // Debounce for 300ms

    return () => clearTimeout(timer);
  }, [query, value, onSearch]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-accent bg-secondary pl-10 pr-4 py-3 text-sm text-content transition-colors placeholder:text-content/40 hover:border-accent/80 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <SearchIcon className="h-5 w-5 text-content/40" />
        </div>
      </div>
    </div>
  );
} 