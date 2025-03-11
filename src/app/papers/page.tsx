'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { Suspense } from 'react';
import PageTransition from '@/components/animations/PageTransition';
import SubjectAlphabetList from '@/components/papers/SubjectAlphabetList';
import SubjectSearchBox from '@/components/papers/SubjectSearchBox';
import { Funnel } from '@phosphor-icons/react';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Get the subject from the URL if it exists
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setSelectedSubject(subjectParam);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex h-full flex-col">
          {/* Fixed Header */}
          <div className="sticky top-0 z-10 border-b border-accent/20 bg-primary px-4 py-4">
            <div className="container mx-auto">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-content">
                  Find a Subject By First Letter
                  <span className="ml-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                    Beta
                  </span>
                </h1>
                
                {selectedSubject && (
                  <button
                    onClick={() => router.push('/papers')}
                    className="flex items-center gap-1 rounded-md border border-accent/20 bg-secondary px-3 py-1.5 text-sm text-content hover:bg-accent hover:text-primary"
                  >
                    <Funnel size={18} weight="bold" />
                    Back to All Subjects
                  </button>
                )}
              </div>
              
              {/* Subject search box */}
              <div className="mt-4 max-w-md">
                <SubjectSearchBox onSelect={handleSelectSubject} />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="container mx-auto flex-1 px-4">
            {!selectedSubject ? (
              /* Subject Alphabet List View */
              <div className="py-8">
                <SubjectAlphabetList />
              </div>
            ) : (
              /* Subject papers view - will be implemented in Phase 5 */
              <div className="flex h-full items-center justify-center py-8">
                <div className="rounded-lg border border-accent bg-secondary p-8 text-center">
                  <h2 className="mb-4 text-xl font-semibold text-content">{selectedSubject}</h2>
                  <p className="text-content/60">
                    Subject-specific papers view will be implemented in Phase 5.
                  </p>
                  <p className="mt-4 text-sm text-content/60">
                    Currently displaying papers for: <span className="font-semibold">{selectedSubject}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
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