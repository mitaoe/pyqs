export interface Paper {
  year: string;
  examType: string;
  branch: string;
  semester: string;
  subject: string;
  standardSubject: string;
  fileName: string;
  url: string;
  isDirectory?: boolean;
  cacheStatus?: 'not-cached' | 'cached' | 'expired';
  cacheSize?: number;
  lastCached?: Date;
}

export interface DBPaper extends Paper {
  _id: string;
}

export interface Stats {
  totalFiles: number;
  totalDirectories: number;
  lastUpdated: Date;
}

export interface Meta {
  years: string[];
  branches: string[];
  examTypes: string[];
  semesters: string[];
  subjects: string[];
  standardSubjects: string[];
}

// Directory structure types
export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
}

export interface DirectoryMeta {
  papers: Paper[];
  years: string[];
  branches: string[];
  examTypes: string[];
  semesters: string[];
  subjects: string[];
  standardSubjects: string[];
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

export type CleanNode = Omit<DirectoryNode, 'parent'> & {
  children: Record<string, CleanNode>;
};

export type DirectoryStructure = DirectoryNode;

export interface DirectoryDocument {
  _id: string;
  structure: DirectoryStructure;
  stats: DirectoryStats;
  meta: DirectoryMeta;
  lastUpdated: Date;
}

// Flat document structure
export interface SavedDocument {
  _id: string;
  papers: Paper[];
  meta: Meta;
  stats: Stats;
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
  subject: string;
  standardSubject: string;
}

export interface BrowseResponse {
  currentPath: string;
  directories: string[];
  papers: PaperResponse[];
} 