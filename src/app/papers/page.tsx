'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import SearchBar from '@/components/ui/SearchBar';
import PaperFilters from '@/components/papers/PaperFilters';
import PaperGrid from '@/components/papers/PaperGrid';
import { usePapers } from '@/contexts/PaperContext';
import { searchPapers, getFilterOptions, type SearchFilters } from '@/utils/search';
import type { DBPaper } from '@/types/paper';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [papers, setPapers] = useState<DBPaper[]>([]);
  const { structure, meta, isLoading } = usePapers();

  // Get current filters from URL
  const filters: SearchFilters = {
    query: searchParams.get('q') || '',
    year: searchParams.get('year') || '',
    branch: searchParams.get('branch') || '',
    semester: searchParams.get('semester') || '',
    examType: searchParams.get('examType') || ''
  };

  // Update URL with new filters
  const updateFilters = (updates: Partial<SearchFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries({ ...filters, ...updates })
      .forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
    router.push(`/papers?${params.toString()}`);
  };

  // Search papers when filters change
  useEffect(() => {
    if (structure) {
      const results = searchPapers(structure, filters);
      setPapers(results as DBPaper[]);
    }
  }, [structure, filters]);

  const filterOptions = meta ? getFilterOptions(meta) : {
    years: [],
    branches: [],
    semesters: [],
    examTypes: []
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <SearchBar
          value={filters.query}
          onSearch={(query) => updateFilters({ query })}
          placeholder="Search papers by name, branch, year..."
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px,1fr]">
        <aside>
          <PaperFilters
            years={filterOptions.years}
            branches={filterOptions.branches}
            semesters={filterOptions.semesters}
            examTypes={filterOptions.examTypes}
            selectedYear={filters.year}
            selectedBranch={filters.branch}
            selectedSemester={filters.semester}
            selectedExamType={filters.examType}
            onYearChange={(year) => updateFilters({ year })}
            onBranchChange={(branch) => updateFilters({ branch })}
            onSemesterChange={(semester) => updateFilters({ semester })}
            onExamTypeChange={(examType) => updateFilters({ examType })}
          />
        </aside>

        <main>
          <PaperGrid papers={papers} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-content/60">Loading search...</div>
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