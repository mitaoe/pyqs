export interface Paper {
  _id?: string;
  fileName: string;
  url: string;
  year: string;
  branch: string;
  semester: string;
  examType: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: Record<string, DirectoryNode>;
  metadata?: Paper;
  stats: {
    totalFiles: number;
    totalDirectories: number;
  };
}

export interface DirectoryStructure {
  lastUpdated: Date;
  stats: {
    totalFiles: number;
    totalDirectories: number;
  };
  structure: DirectoryNode;
  meta: {
    years: string[];
    branches: string[];
    examTypes: string[];
    semesters: string[];
  };
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface SearchResult {
  papers: Paper[];
  total: number;
  page: number;
  perPage: number;
}

export interface PaperResponse {
  name: string;
  downloadUrl: string;
  year: string;
  branch: string;
  semester: string;
  examType: string;
}

export interface BrowseResponse {
  currentPath: string;
  directories: string[];
  papers: PaperResponse[];
} 