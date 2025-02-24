export interface Paper {
  year: string;
  examType: string;
  branch: string;
  semester: string;
  fileName: string;
  url: string;
  isDirectory?: boolean;
}

export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
}

export interface DirectoryMeta {
  years: string[];
  branches: string[];
  examTypes: string[];
  semesters: string[];
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  parent?: DirectoryNode;
  children: Record<string, DirectoryNode>;
  stats: DirectoryStats;
  metadata?: Paper;
  meta: DirectoryMeta;
}

export interface DirectoryStructure extends DirectoryNode {}

export interface SavedDocument {
  _id: string;
  structure: DirectoryStructure;
  stats: DirectoryStats;
  meta: {
    years: string[];
    branches: string[];
    examTypes: string[];
    semesters: string[];
  };
  lastUpdated: Date;
}

export type CleanNode = Omit<DirectoryNode, 'parent'> & {
  children: Record<string, CleanNode>;
};

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