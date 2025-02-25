import type { DirectoryNode, Paper, DirectoryMeta } from '@/types/paper';
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

export function searchPapers(node: DirectoryNode, filters: SearchFilters): SearchResults {
  const results: Paper[] = [];
  const page = filters.page || 1;
  const perPage = filters.perPage || 12;
  const seenPaths = new Set<string>(); // Track unique papers
  
  function traverse(node: DirectoryNode) {
    if (node.type === 'file' && node.metadata) {
      const metadata = node.metadata;
      
      // Skip if we've already seen this paper (avoid duplicates)
      if (seenPaths.has(node.path)) {
        return;
      }
      seenPaths.add(node.path);
      
      // Standardize values for comparison
      const standardBranch = standardizeValue(metadata.branch, branchMappings);
      const standardYear = standardizeValue(metadata.year, yearMappings);
      const standardExam = standardizeValue(metadata.examType, examMappings);
      const standardSem = standardizeValue(metadata.semester, semesterMappings);

      // Apply filters
      const matchesBranch = !filters.branch || standardBranch === filters.branch;
      const matchesYear = !filters.year || standardYear === filters.year;
      const matchesExam = !filters.examType || standardExam === filters.examType;
      const matchesSem = !filters.semester || standardSem === filters.semester;
      
      // Full text search
      const searchQuery = filters.query?.toLowerCase() || '';
      const matchesQuery = !searchQuery || [
        metadata.fileName,
        standardBranch,
        standardYear,
        standardSem,
        standardExam
      ].some(field => 
        field.toLowerCase().includes(searchQuery)
      );

      if (matchesBranch && matchesYear && matchesExam && matchesSem && matchesQuery) {
        results.push({
          ...metadata,
          branch: standardBranch,
          year: standardYear,
          examType: standardExam,
          semester: standardSem
        });
      }
    }

    // Recursively search children
    if (node.children) {
      Object.values(node.children).forEach(traverse);
    }
  }

  traverse(node);

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
  return {
    years: Object.values(STANDARD_VALUES.YEARS).map(year => ({
      label: year,
      value: year
    })),
    branches: Object.values(STANDARD_VALUES.BRANCHES).map(branch => ({
      label: branch,
      value: branch
    })),
    semesters: Object.values(STANDARD_VALUES.SEMESTERS).map(sem => ({
      label: sem,
      value: sem
    })),
    examTypes: Object.values(STANDARD_VALUES.EXAM_TYPES).map(type => ({
      label: type,
      value: type
    }))
  };
} 