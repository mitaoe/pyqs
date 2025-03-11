import type { Paper, DirectoryMeta } from '@/types/paper';
import { toast } from 'sonner';
import { 
  STANDARD_VALUES,
  branchMappings, 
  yearMappings, 
  examMappings, 
  semesterMappings
} from '@/config/mappings';

export interface SearchFilters {
  query?: string;
  subject?: string;
  year?: string;
  branch?: string;
  semester?: string;
  examType?: string;
  page?: number;
  perPage?: number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface SearchResults {
  papers: Paper[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

function standardizeValue(value: string, mappings: Record<string, string>): string {
  return mappings[value.toUpperCase()] || value;
}

export function searchPapers(meta: DirectoryMeta, filters: SearchFilters): SearchResults {
  const page = filters.page || 1;
  const perPage = filters.perPage || 12;
  
  if (!meta.papers) {
    return {
      papers: [],
      totalPages: 0,
      currentPage: page,
      totalItems: 0
    };
  }
  
  // Apply filters
  const results = meta.papers.filter(paper => {
    // Standardize values for comparison
    const standardBranch = standardizeValue(paper.branch, branchMappings);
    const standardYear = standardizeValue(paper.year, yearMappings);
    const standardExam = standardizeValue(paper.examType, examMappings);
    const standardSem = standardizeValue(paper.semester, semesterMappings);

    // Apply filters
    const matchesBranch = !filters.branch || standardBranch === filters.branch;
    const matchesYear = !filters.year || standardYear === filters.year;
    const matchesExam = !filters.examType || standardExam === filters.examType;
    const matchesSem = !filters.semester || standardSem === filters.semester;
    
    // Full text search
    const searchQuery = filters.query?.toLowerCase() || '';
    const matchesQuery = !searchQuery || [
      paper.fileName,
      standardBranch,
      standardYear,
      standardSem,
      standardExam
    ].some(field => 
      field?.toLowerCase().includes(searchQuery)
    );

    return matchesBranch && matchesYear && matchesExam && matchesSem && matchesQuery;
  });

  // Sort results by year (descending) and filename
  results.sort((a, b) => {
    const yearDiff = b.year.localeCompare(a.year);
    return yearDiff !== 0 ? yearDiff : a.fileName.localeCompare(b.fileName);
  });

  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedResults = results.slice(startIndex, startIndex + perPage);

  // Show toast for search results
  if (filters.query) {
    if (totalItems === 0) {
      toast.error(`No papers found for "${filters.query}"`);
    } else {
      toast.success(`Found ${totalItems} paper${totalItems === 1 ? '' : 's'}`);
    }
  }

  // Show toast for filter changes
  const activeFilters = [
    filters.subject && `Subject: ${filters.subject}`,
    filters.branch && `Branch: ${filters.branch}`,
    filters.year && `Year: ${filters.year}`,
    filters.semester && `Semester: ${filters.semester}`,
    filters.examType && `Exam: ${filters.examType}`
  ].filter(Boolean);

  if (activeFilters.length > 0 && !filters.query) {
    if (totalItems === 0) {
      toast.error('No papers match the selected filters');
    } else {
      toast.success(`Found ${totalItems} paper${totalItems === 1 ? '' : 's'} matching your filters`);
    }
  }

  return {
    papers: paginatedResults,
    totalPages,
    currentPage: page,
    totalItems
  };
}

export function getFilterOptions(meta: DirectoryMeta) {
  // Filter standard values based on what's available in meta
  return {
    subjects: Object.values(STANDARD_VALUES.SUBJECTS)
      .filter(subject => meta.subjects.includes(subject))
      .map(subject => ({
        label: subject,
        value: subject
      })),
    years: Object.values(STANDARD_VALUES.YEARS)
      .filter(year => meta.years.includes(year))
      .map(year => ({
        label: year,
        value: year
      })),
    branches: Object.values(STANDARD_VALUES.BRANCHES)
      .filter(branch => meta.branches.includes(branch))
      .map(branch => ({
        label: branch,
        value: branch
      })),
    semesters: Object.values(STANDARD_VALUES.SEMESTERS)
      .filter(sem => meta.semesters.includes(sem))
      .map(sem => ({
        label: sem,
        value: sem
      })),
    examTypes: Object.values(STANDARD_VALUES.EXAM_TYPES)
      .filter(type => meta.examTypes.includes(type))
      .map(type => ({
        label: type,
        value: type
      }))
  };
} 