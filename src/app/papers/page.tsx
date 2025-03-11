'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { Suspense } from 'react';
import PageTransition from '@/components/animations/PageTransition';
import SubjectAlphabetList, { AlphabetBar } from '@/components/papers/SubjectAlphabetList';
import SubjectSearchBox from '@/components/papers/SubjectSearchBox';
import { Funnel, ArrowUp } from '@phosphor-icons/react';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const alphabetRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // Get the subject from the URL if it exists
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setSelectedSubject(subjectParam);
    } else {
      setSelectedSubject(null);
    }
  }, [searchParams]);

  // Handle scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!searchBarRef.current) return;
      
      // Get the offset position of the navbar
      const searchBarPosition = searchBarRef.current.offsetTop;
      
      // Check if we've scrolled past the search bar's original position
      if (window.scrollY > searchBarPosition - 1) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Trigger once on mount to check initial position
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle subject selection
  const handleSelectSubject = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
  };

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alphabetRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-primary text-content">
        {!selectedSubject ? (
          <>
            {/* Main header with site title if needed */}
            <header className="bg-primary border-b border-accent/10 px-4">
              <div className="container mx-auto py-2">
                {/* Any header content can go here */}
              </div>
            </header>
            
            {/* Alphabet Navigation */}
            <div 
              ref={alphabetRef}
              className="w-full bg-primary px-4 py-4 md:py-6"
            >
              <div className="container mx-auto">
                <AlphabetBar />
              </div>
            </div>

            {/* Search bar container - this is what gets the sticky position */}
            <div 
              ref={searchBarRef}
              className={`sticky top-0 z-30 bg-primary transition-all duration-300 
                ${scrolled ? 'shadow-md border-b border-accent/10' : ''}
              `}
            >
              <div className="container mx-auto px-4 py-3">
                <div className="relative w-full max-w-2xl mx-auto">
                  <SubjectSearchBox onSelect={handleSelectSubject} />
                  
                  {/* Go up button - positioned inside the search component */}
                  <div 
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-300 
                      ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                  >
                    <button
                      onClick={scrollToTop}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary hover:bg-accent/80 transition-colors"
                      aria-label="Back to top"
                      tabIndex={scrolled ? 0 : -1}
                    >
                      <ArrowUp size={16} weight="bold" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* A-Z Subject listing */}
            <div className="container mx-auto px-4 py-6">
              <SubjectAlphabetList />
            </div>
          </>
        ) : (
          /* Subject papers view - will be implemented in Phase 5 */
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-content">
                {selectedSubject}
              </h1>
              
              <button
                onClick={() => router.push('/papers')}
                className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm text-primary hover:bg-accent/80 transition-colors"
              >
                <Funnel size={18} weight="bold" />
                Back to All Subjects
              </button>
            </div>
            
            <div className="flex h-full items-center justify-center py-8">
              <div className="rounded-lg border border-accent/20 bg-secondary p-8 text-center">
                <p className="text-content/60">
                  Subject-specific papers view will be implemented in Phase 5.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-primary">
      <div className="text-content/60">Loading subjects...</div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Layout>
      <Suspense fallback={<SearchLoadingFallback />}>
        <SearchContent />
      </Suspense>
    </Layout>
  );
} 