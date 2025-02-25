import type { DirectoryNode, Paper, DirectoryMeta } from '@/types/paper';
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
}

export interface FilterOption {
  label: string;
  value: string;
}

export function searchPapers(node: DirectoryNode, filters: SearchFilters): Paper[] {
  const results: Paper[] = [];
  
  function traverse(node: DirectoryNode) {
    if (node.type === 'file' && node.metadata) {
      const metadata = node.metadata;
      
      // Standardize values for comparison
      const standardBranch = branchMappings[metadata.branch.toUpperCase()] || metadata.branch;
      const standardYear = yearMappings[metadata.year.toUpperCase()] || metadata.year;
      const standardExam = examMappings[metadata.examType.toUpperCase()] || metadata.examType;
      const standardSem = semesterMappings[metadata.semester.toUpperCase()] || metadata.semester;

      // Apply filters
      const matchesBranch = !filters.branch || standardBranch === filters.branch;
      const matchesYear = !filters.year || standardYear === filters.year;
      const matchesExam = !filters.examType || standardExam === filters.examType;
      const matchesSem = !filters.semester || standardSem === filters.semester;
      
      // Full text search
      const matchesQuery = !filters.query || [
        metadata.fileName,
        metadata.branch,
        metadata.year,
        metadata.semester,
        metadata.examType
      ].some(field => 
        field.toLowerCase().includes(filters.query!.toLowerCase())
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
  return results;
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