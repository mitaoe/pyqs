'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface SubjectSearchBoxProps {
  onSelect?: (subject: string) => void;
}

const SubjectSearchBox = ({ onSelect }: SubjectSearchBoxProps) => {
  const { meta } = usePapers();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter subjects based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions([]);
      return;
    }

    if (meta?.standardSubjects?.length) {
      const query = searchQuery.toLowerCase();
      const filteredSubjects = meta.standardSubjects
        .filter(subject => subject.toLowerCase().includes(query))
        .sort((a, b) => {
          // Prioritize subjects that start with the query
          const aStartsWith = a.toLowerCase().startsWith(query);
          const bStartsWith = b.toLowerCase().startsWith(query);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // Then sort alphabetically
          return a.localeCompare(b);
        })
        .slice(0, 10); // Limit to top 10 matches
      
      setSuggestions(filteredSubjects);
    }
  }, [searchQuery, meta?.standardSubjects]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle subject selection
  const handleSelectSubject = (subject: string) => {
    setSearchQuery('');
    setShowSuggestions(false);
    
    if (onSelect) {
      onSelect(subject);
    } else {
      router.push(`/papers?subject=${encodeURIComponent(subject)}`);
    }
  };

  // Highlight matching text in suggestions
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <span className="font-bold text-accent">
          {text.substring(index, index + query.length)}
        </span>
        {text.substring(index + query.length)}
      </>
    );
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search for subjects..."
          className="w-full h-12 rounded-full border-2 border-accent/30 bg-secondary px-6 py-3 pl-12 text-content placeholder:text-content/50 focus:border-accent focus:outline-none shadow-sm transition-all"
          aria-label="Search for subjects"
        />
        <MagnifyingGlass 
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" 
          weight="bold" 
          size={20}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-lg border border-accent/20 bg-secondary shadow-lg"
        >
          <ul className="py-2">
            {suggestions.map((subject) => (
              <li key={subject}>
                <button
                  className="w-full px-5 py-3 text-left text-content hover:bg-accent/10 transition-colors"
                  onClick={() => handleSelectSubject(subject)}
                >
                  {highlightMatch(subject, searchQuery)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SubjectSearchBox; 