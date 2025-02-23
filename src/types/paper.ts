export interface Paper {
  id: string;
  year: string;
  branch?: string;
  semester?: string;
  subject?: string;
  examType?: string;
  fileName: string;
  originalUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterOption {
  label: string;
  value: string;
} 