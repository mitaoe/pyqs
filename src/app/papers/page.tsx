// page.tsx
'use client';

import { useState, useEffect } from 'react';
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
  const [showGoUp, setShowGoUp] = useState(false);

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

  // Attach scroll listener to our scrollable container
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

  // Handle subject selection
  const handleSelectSubject = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
  };

  // Scroll to top when the arrow button is clicked
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
          /* Subject papers view - will be implemented in Phase 5 */
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-content">
                {selectedSubject}
              </h1>
              <button
                onClick={() => router.push('/papers')}
                className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm text-primary transition-colors focus:outline-none"
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
