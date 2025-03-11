'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { motion } from 'framer-motion';
import { groupSubjectsByLetter, getAvailableLetters } from '@/utils/subjectSearch';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Global state for communication between components
interface GlobalAlphabetRefs {
  current: Record<string, HTMLDivElement | null>;
}

// Store refs globally for access between components
let globalSectionRefs: GlobalAlphabetRefs = {
  current: {}
};

// The component that displays just the A-Z bar
export const AlphabetBar = () => {
  const { meta } = usePapers();
  const [availableLetters, setAvailableLetters] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Determine which letters have subjects
  useEffect(() => {
    if (meta?.standardSubjects?.length) {
      setAvailableLetters(getAvailableLetters(meta.standardSubjects));
    }
  }, [meta?.standardSubjects]);

  const scrollToSection = (letter: string) => {
    if (globalSectionRefs.current[letter]) {
      globalSectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(letter);
    }
  };

  return (
    <div className="w-full mx-auto">
      <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
        {ALPHABET.map(letter => (
          <button
            key={letter}
            onClick={() => availableLetters.has(letter) && scrollToSection(letter)}
            className={`
              flex items-center justify-center rounded-md transition-colors
              h-8 w-8 text-base
              sm:h-10 sm:w-10 sm:text-lg
              md:h-11 md:w-11
              lg:h-12 lg:w-12 lg:text-xl
              ${availableLetters.has(letter)
                ? 'cursor-pointer bg-secondary hover:bg-accent hover:text-primary'
                : 'cursor-default opacity-30 bg-secondary/20'
              }
              ${activeSection === letter ? 'bg-accent text-primary' : 'text-content'}
            `}
            disabled={!availableLetters.has(letter)}
            aria-label={`Jump to subjects starting with letter ${letter}`}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
};

// Main component with subject listing
const SubjectAlphabetList = () => {
  const { meta } = usePapers();
  const router = useRouter();
  const [subjectsByLetter, setSubjectsByLetter] = useState<Record<string, string[]>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Group subjects by their first letter
  useEffect(() => {
    if (meta?.standardSubjects?.length) {
      setSubjectsByLetter(groupSubjectsByLetter(meta.standardSubjects));
    }
  }, [meta?.standardSubjects]);

  // Connect local refs to the global refs
  useEffect(() => {
    globalSectionRefs = {
      current: sectionRefs.current
    };
  }, []);

  // Handle subject selection
  const handleSubjectClick = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
  };

  return (
    <div className="w-full">
      {/* Subject Sections */}
      <div className="space-y-16">
        {ALPHABET.map(letter => {
          if (!subjectsByLetter[letter]?.length) return null;

          return (
            <motion.div 
              key={letter}
              ref={el => sectionRefs.current[letter] = el}
              className="scroll-mt-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center mb-6">
                <h2 className="flex h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-md bg-accent text-xl sm:text-2xl font-bold text-primary">
                  {letter}
                </h2>
                <div className="h-px flex-1 bg-accent/20 ml-4"></div>
              </div>

              <div className="grid gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {subjectsByLetter[letter]?.map((subject, index) => (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    <button
                      onClick={() => handleSubjectClick(subject)}
                      className="w-full text-left py-2 px-1 border-b border-accent/20 text-content hover:text-accent transition-colors"
                    >
                      {subject}
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SubjectAlphabetList; 