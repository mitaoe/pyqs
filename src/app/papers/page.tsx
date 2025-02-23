'use client';

import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import SearchBar from '@/components/ui/SearchBar';
import PaperFilters from '@/components/papers/PaperFilters';
import PaperGrid from '@/components/papers/PaperGrid';
import type { Paper, FilterOption } from '@/types/paper';

// Example data - replace with actual data from API
const mockYears: FilterOption[] = [
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
];

const mockBranches: FilterOption[] = [
  { label: 'Computer Science', value: 'cs' },
  { label: 'Mechanical', value: 'mech' },
  { label: 'Civil', value: 'civil' },
];

const mockSemesters: FilterOption[] = [
  { label: 'Semester 1', value: '1' },
  { label: 'Semester 2', value: '2' },
  { label: 'Semester 3', value: '3' },
  { label: 'Semester 4', value: '4' },
];

export default function PapersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    // TODO: Implement actual search
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Question Papers</h1>
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <PaperFilters
              years={mockYears}
              branches={mockBranches}
              semesters={mockSemesters}
              selectedYear={selectedYear}
              selectedBranch={selectedBranch}
              selectedSemester={selectedSemester}
              onYearChange={setSelectedYear}
              onBranchChange={setSelectedBranch}
              onSemesterChange={setSelectedSemester}
            />
          </div>

          <div className="lg:col-span-3">
            <PaperGrid papers={papers} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </Layout>
  );
} 