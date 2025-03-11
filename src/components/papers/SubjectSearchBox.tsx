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
          className="w-full h-11 rounded-full border border-gray-600 bg-gray-900 py-2 pl-11 pr-10 text-white placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none transition-all shadow-sm"
          aria-label="Search for subjects"
        />
        <MagnifyingGlass 
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" 
          weight="bold" 
          size={18}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-700 bg-gray-900 shadow-lg"
        >
          <ul className="py-1">
            {suggestions.map((subject) => {
              const { prefix, highlight, suffix } = getHighlightedText(subject, searchQuery);
              
              return (
                <li key={subject} className="group">
                  <button
                    className="w-full px-4 py-2.5 text-left text-gray-300 group-hover:text-white group-hover:bg-gray-800 transition-all duration-150"
                    onClick={() => handleSelectSubject(subject)}
                  >
                    {prefix}
                    <span className="font-medium text-gray-200">{highlight}</span>
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