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

const ITEMS_PER_PAGE = 12;

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [papers, setPapers] = useState<DBPaper[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { structure, meta, isLoading } = usePapers();

  // Get current filters from URL using useMemo to prevent unnecessary recalculations
  const filters = useMemo<SearchFilters>(() => ({
    query: searchParams.get('q') || '',
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
    if (structure) {
      const results = searchPapers(structure, filters);
      setPapers(results.papers as DBPaper[]);
      setTotalPages(results.totalPages);
      setTotalItems(results.totalItems);
    }
  }, [structure, filters]);

  // Get filter options using useMemo to prevent unnecessary recalculations
  const filterOptions = useMemo(() => 
    meta ? getFilterOptions(meta) : {
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-content mb-4">Search Papers</h1>
        <SearchBar
          value={filters.query || ''}
          onSearch={(query) => handleFilterChange('query', query)}
          placeholder="Search by paper name, branch, year..."
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-6">
          <PaperFilters
            years={filterOptions.years}
            branches={filterOptions.branches}
            semesters={filterOptions.semesters}
            examTypes={filterOptions.examTypes}
            selectedYear={filters.year || ''}
            selectedBranch={filters.branch || ''}
            selectedSemester={filters.semester || ''}
            selectedExamType={filters.examType || ''}
            onYearChange={(year) => handleFilterChange('year', year)}
            onBranchChange={(branch) => handleFilterChange('branch', branch)}
            onSemesterChange={(semester) => handleFilterChange('semester', semester)}
            onExamTypeChange={(examType) => handleFilterChange('examType', examType)}
          />

          {/* Active Filters Summary */}
          {(filters.year || filters.branch || filters.semester || filters.examType) && (
            <div className="rounded-lg border border-accent bg-secondary p-4">
              <h4 className="text-sm font-medium text-content mb-3">Active Filters</h4>
              <div className="space-y-2">
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

        <main className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content/60">
              {totalItems} {totalItems === 1 ? 'paper' : 'papers'} found
            </div>
          </div>

          <PaperGrid papers={papers} isLoading={isLoading} />

          <Pagination
            currentPage={filters.page || 1}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
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
      <SearchContent />
    </Layout>
  );
} 