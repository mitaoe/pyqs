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

  // Get the subject from the URL if it exists
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setSelectedSubject(subjectParam);
      // Scroll to top when selecting a subject
      window.scrollTo(0, 0);
    } else {
      setSelectedSubject(null);
    }
  }, [searchParams]);

  // Handle scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Set scrolled to true when scrolling down even a little bit
      if (window.scrollY > 100) {
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
            {/* Alphabet Navigation */}
            <div 
              ref={alphabetRef}
              className="w-full bg-primary px-4 py-6"
            >
              <div className="container mx-auto">
                <AlphabetBar />
              </div>
            </div>

            {/* Search bar container */}
            <div 
              className={`sticky top-0 z-30 transition-all duration-300 py-3 ${scrolled ? '' : ''}`}
            >
              <div className="container mx-auto px-4">
                <div className="relative max-w-xl mx-auto rounded-full">
                  <SubjectSearchBox onSelect={handleSelectSubject} />
                  
                  {/* Go up button */}
                  <div 
                    className="fixed bottom-6 right-6 z-50 transition-all duration-300"
                    style={{ opacity: scrolled ? 1 : 0, transform: scrolled ? 'scale(1)' : 'scale(0.8)', pointerEvents: scrolled ? 'auto' : 'none' }}
                  >
                    <button
                      onClick={scrollToTop}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border-2 border-gray-500 text-white shadow-lg hover:border-white hover:bg-gray-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                      aria-label="Back to top"
                      tabIndex={scrolled ? 0 : -1}
                    >
                      <ArrowUp size={24} weight="bold" />
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