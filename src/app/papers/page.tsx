'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import SearchBar from '@/components/ui/SearchBar';
import PaperFilters from '@/components/papers/PaperFilters';
import PaperGrid from '@/components/papers/PaperGrid';
import Pagination from '@/components/ui/Pagination';
import { usePapers } from '@/contexts/PaperContext';
import { searchPapers, getFilterOptions, type SearchFilters } from '@/utils/search';
import type { DBPaper } from '@/types/paper';
import { Suspense } from 'react';

const ITEMS_PER_PAGE = 12;

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [papers, setPapers] = useState<DBPaper[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { meta, isLoading } = usePapers();

  // Get current filters from URL using useMemo to prevent unnecessary recalculations
  const filters = useMemo<SearchFilters>(() => ({
    query: searchParams.get('q') || '',
    subject: searchParams.get('subject') || '',
    year: searchParams.get('year') || '',
    branch: searchParams.get('branch') || '',
    semester: searchParams.get('semester') || '',
    examType: searchParams.get('examType') || '',
    page: Number(searchParams.get('page')) || 1,
    perPage: ITEMS_PER_PAGE
  }), [searchParams]);

  // Update URL with new filters using useCallback to prevent recreation on every render
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries({ ...filters, ...updates })
      .forEach(([key, value]) => {
        if (value) {
          params.set(key, value.toString());
        } else {
          params.delete(key);
        }
      });
    router.push(`/papers?${params.toString()}`);
  }, [searchParams, router, filters]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    updateFilters({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateFilters]);

  // Search papers when filters or structure changes
  useEffect(() => {
    if (meta) {
      const results = searchPapers(meta, filters);
      setPapers(results.papers as DBPaper[]);
      setTotalPages(results.totalPages);
      setTotalItems(results.totalItems);
    }
  }, [meta, filters]);

  // Get filter options using useMemo to prevent unnecessary recalculations
  const filterOptions = useMemo(() => 
    meta ? getFilterOptions(meta) : {
      subjects: [],
      years: [],
      branches: [],
      semesters: [],
      examTypes: []
    }
  , [meta]);

  // Handle filter changes with useCallback
  const handleFilterChange = useCallback((key: keyof SearchFilters, value: string) => {
    updateFilters({ [key]: value, page: 1 });
  }, [updateFilters]);

  return (
    <div className="flex h-full flex-col">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 border-b border-accent/20 bg-primary px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-content">
            Search Papers
            <span className="ml-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
              Beta
            </span>
          </h1>
          <div className="w-96">
            <SearchBar
              value={filters.query || ''}
              onSearch={(query) => handleFilterChange('query', query)}
              placeholder="Search by paper name, branch, year..."
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto flex-1 px-4">
        <div className="grid h-full gap-8 lg:grid-cols-[280px,1fr]">
          {/* Fixed Filters Column */}
          <aside className="sticky top-[73px] flex h-[calc(100vh-73px)] flex-none flex-col space-y-6 overflow-y-auto py-6">
            <PaperFilters
              subjects={filterOptions.subjects}
              years={filterOptions.years}
              branches={filterOptions.branches}
              semesters={filterOptions.semesters}
              examTypes={filterOptions.examTypes}
              selectedSubject={filters.subject || ''}
              selectedYear={filters.year || ''}
              selectedBranch={filters.branch || ''}
              selectedSemester={filters.semester || ''}
              selectedExamType={filters.examType || ''}
              onSubjectChange={(subject) => handleFilterChange('subject', subject)}
              onYearChange={(year) => handleFilterChange('year', year)}
              onBranchChange={(branch) => handleFilterChange('branch', branch)}
              onSemesterChange={(semester) => handleFilterChange('semester', semester)}
              onExamTypeChange={(examType) => handleFilterChange('examType', examType)}
            />

            {/* Active Filters Summary */}
            {(filters.subject || filters.year || filters.branch || filters.semester || filters.examType) && (
              <div className="rounded-lg border border-accent bg-secondary p-4">
                <h4 className="mb-3 text-sm font-medium text-content">Active Filters</h4>
                <div className="space-y-2">
                  {filters.subject && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content/60">Subject:</span>
                      <span className="text-content">{filters.subject}</span>
                    </div>
                  )}
                  {filters.year && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content/60">Year:</span>
                      <span className="text-content">{filters.year}</span>
                    </div>
                  )}
                  {filters.branch && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content/60">Branch:</span>
                      <span className="text-content">{filters.branch}</span>
                    </div>
                  )}
                  {filters.semester && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content/60">Semester:</span>
                      <span className="text-content">{filters.semester}</span>
                    </div>
                  )}
                  {filters.examType && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content/60">Exam Type:</span>
                      <span className="text-content">{filters.examType}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* Results Column */}
          <main className="flex h-[calc(100vh-73px)] flex-col py-6">
            <div className="flex-none mb-4">
              <div className="text-sm text-content/60">
                {totalItems} {totalItems === 1 ? 'paper' : 'papers'} found
                {filters.subject && ` in ${filters.subject}`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <PaperGrid 
                papers={papers} 
                isLoading={isLoading} 
                groupBySubject={!filters.subject} 
              />
            </div>

            <div className="flex-none mt-4 border-t border-accent/20 pt-4">
              <Pagination
                currentPage={filters.page || 1}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </main>
        </div>
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