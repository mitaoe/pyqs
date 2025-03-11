'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { motion } from 'framer-motion';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const SubjectAlphabetList = () => {
  const { meta } = usePapers();
  const router = useRouter();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [subjectsByLetter, setSubjectsByLetter] = useState<Record<string, string[]>>({});
  const [availableLetters, setAvailableLetters] = useState<Set<string>>(new Set());

  // Group subjects by their first letter
  useEffect(() => {
    if (meta?.standardSubjects?.length) {
      const groupedSubjects: Record<string, string[]> = {};
      const lettersWithSubjects = new Set<string>();

      meta.standardSubjects.forEach(subject => {
        const firstLetter = subject.charAt(0).toUpperCase();
        if (!groupedSubjects[firstLetter]) {
          groupedSubjects[firstLetter] = [];
        }
        if (!groupedSubjects[firstLetter].includes(subject)) {
          groupedSubjects[firstLetter].push(subject);
          lettersWithSubjects.add(firstLetter);
        }
      });

      // Sort subjects alphabetically within each letter
      Object.keys(groupedSubjects).forEach(letter => {
        groupedSubjects[letter].sort();
      });

      setSubjectsByLetter(groupedSubjects);
      setAvailableLetters(lettersWithSubjects);
    }
  }, [meta?.standardSubjects]);

  // Handle scrolling to a section when clicking a letter
  const scrollToSection = (letter: string) => {
    if (sectionRefs.current[letter]) {
      sectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(letter);
    }
  };

  // Handle subject selection
  const handleSubjectClick = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Alphabet Navigation - InStyle.com style */}
      <div className="mb-12 bg-secondary rounded-lg shadow-md p-6">
        <h2 className="mb-6 text-center text-2xl font-semibold text-content">Find a Subject By First Name:</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {ALPHABET.map(letter => (
            <button
              key={letter}
              onClick={() => availableLetters.has(letter) && scrollToSection(letter)}
              className={`
                flex h-14 w-14 items-center justify-center rounded-md text-lg font-medium transition-all
                border ${availableLetters.has(letter) ? 'border-accent' : 'border-content/10'}
                ${availableLetters.has(letter)
                  ? 'cursor-pointer hover:bg-accent hover:text-primary'
                  : 'cursor-default opacity-30 bg-transparent'
                }
                ${activeSection === letter ? 'bg-accent text-primary' : 'bg-secondary text-content'}
              `}
              disabled={!availableLetters.has(letter)}
              aria-label={`Jump to subjects starting with letter ${letter}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Sections */}
      <div className="space-y-20">
        {ALPHABET.map(letter => {
          if (!subjectsByLetter[letter]?.length) return null;

          return (
            <motion.div 
              key={letter}
              ref={el => sectionRefs.current[letter] = el}
              className="scroll-mt-32"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center mb-8">
                <div className="h-px flex-1 bg-accent/20 mr-4"></div>
                <h2 className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-3xl font-bold text-primary shadow-lg">
                  {letter}
                </h2>
                <div className="h-px flex-1 bg-accent/20 ml-4"></div>
              </div>

              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {subjectsByLetter[letter]?.map((subject, index) => (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => handleSubjectClick(subject)}
                      className="w-full text-left py-3 px-1 border-b border-accent/20 text-content hover:text-accent transition-colors"
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