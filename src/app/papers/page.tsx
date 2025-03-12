'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { Suspense } from 'react';
import PageTransition from '@/components/animations/PageTransition';
import SubjectAlphabetList, { AlphabetBar } from '@/components/papers/SubjectAlphabetList';
import SubjectSearchBox from '@/components/papers/SubjectSearchBox';
import { Funnel } from '@phosphor-icons/react';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
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

  // Handle subject selection
  const handleSelectSubject = (subject: string) => {
    router.push(`/papers?subject=${encodeURIComponent(subject)}`);
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
            <div className="flex justify-center px-4 py-3 sticky top-0 z-30 pointer-events-none">
              <div className="w-full max-w-xl pointer-events-auto">
                <SubjectSearchBox onSelect={handleSelectSubject} />
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