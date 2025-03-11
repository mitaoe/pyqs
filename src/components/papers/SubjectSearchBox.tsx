'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { searchSubjects, getHighlightedText } from '@/utils/subjectSearch';

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
    const filteredSubjects = searchSubjects(meta, searchQuery);
    setSuggestions(filteredSubjects);
  }, [searchQuery, meta]);

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
          className="w-full h-11 rounded-md border border-accent/30 bg-secondary py-2 pl-10 pr-12 text-content placeholder:text-content/50 focus:border-accent focus:outline-none"
          aria-label="Search for subjects"
        />
        <MagnifyingGlass 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/70" 
          weight="bold" 
          size={18}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-accent/20 bg-secondary shadow-md"
        >
          <ul className="py-1">
            {suggestions.map((subject) => {
              const { prefix, highlight, suffix } = getHighlightedText(subject, searchQuery);
              
              return (
                <li key={subject}>
                  <button
                    className="w-full px-4 py-2.5 text-left text-content hover:bg-accent/10 transition-colors"
                    onClick={() => handleSelectSubject(subject)}
                  >
                    {prefix}
                    <span className="font-bold text-accent">{highlight}</span>
                    {suffix}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SubjectSearchBox; 