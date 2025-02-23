export interface Paper {
  _id?: string;
  fileName: string;
  downloadUrl: string;
  originalUrl: string;
  year: string;
  branch: string;
  semester: string;
  examType: string;
  path: string;  // Store the full path for navigation
  createdAt?: Date;
  updatedAt?: Date;
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

export interface FilterOption {
  label: string;
  value: string;
} 