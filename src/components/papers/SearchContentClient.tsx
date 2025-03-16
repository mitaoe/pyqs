'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageTransition from '@/components/animations/PageTransition';
import SubjectAlphabetList, { AlphabetBar } from '@/components/papers/SubjectAlphabetList';
import SubjectSearchBox from '@/components/papers/SubjectSearchBox';
import SubjectPapers from '@/components/papers/SubjectPapers';
import { ArrowUp } from '@phosphor-icons/react';

export default function SearchContentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showGoUp, setShowGoUp] = useState(false);

  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setSelectedSubject(subjectParam);
      window.scrollTo(0, 0);
    } else {
      setSelectedSubject(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const scrollContainer = document.getElementById('scrollable-content');
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer.scrollTop > 100) {
        setShowGoUp(true);
      } else {
        setShowGoUp(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSelectSubject = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
  };

  const handleGoUp = () => {
    const scrollContainer = document.getElementById('scrollable-content');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  return (
    <PageTransition>
      <div className="min-h-screen bg-primary text-content">
        {!selectedSubject ? (
          <>
            {/* Alphabet Navigation */}
            <div className="w-full bg-primary px-4 py-6">
              <div className="container mx-auto">
                <AlphabetBar />
              </div>
            </div>

            {/* Top sticky container: search bar and arrow button side by side */}
            <div className="flex items-center gap-3 justify-center px-4 py-3 sticky top-0 z-30">
              <div className="w-full max-w-xl">
                <SubjectSearchBox onSelect={handleSelectSubject} />
              </div>
              {showGoUp && (
                <button
                  onClick={handleGoUp}
                  aria-label="Go to top"
                  className="p-2 rounded-full bg-gray-800 shadow-md transition-transform duration-200 hover:scale-105 focus:outline-none"
                >
                  <ArrowUp size={24} weight="bold" className="text-white" />
                </button>
              )}
            </div>

            {/* A-Z Subject listing */}
            <div className="container mx-auto px-4 py-6">
              <SubjectAlphabetList />
            </div>
          </>
        ) : (
          <SubjectPapers />
        )}
      </div>
    </PageTransition>
  );
} 