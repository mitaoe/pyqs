import type { DirectoryMeta, Paper } from '@/types/paper';

/**
 * Filter subjects that match a search query
 */
export function searchSubjects(
  meta: DirectoryMeta | null, 
  query: string, 
  limit: number = 10
): string[] {
  if (!meta?.standardSubjects?.length || !query.trim()) {
    return [];
  }
  
  const searchTerm = query.toLowerCase();
  
  return meta.standardSubjects
    .filter(subject => subject.toLowerCase().includes(searchTerm))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(searchTerm);
      const bStartsWith = b.toLowerCase().startsWith(searchTerm);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return a.localeCompare(b);
    })
    .slice(0, limit);
}

/**
 * Group subjects by their first letter
 */
export function groupSubjectsByLetter(
  subjects: string[]
): Record<string, string[]> {
  const groupedSubjects: Record<string, string[]> = {};
  
  subjects.forEach(subject => {
    const firstLetter = subject.charAt(0).toUpperCase();
    if (!groupedSubjects[firstLetter]) {
      groupedSubjects[firstLetter] = [];
    }
    if (!groupedSubjects[firstLetter].includes(subject)) {
      groupedSubjects[firstLetter].push(subject);
    }
  });
  
  Object.keys(groupedSubjects).forEach(letter => {
    groupedSubjects[letter].sort();
  });
  
  return groupedSubjects;
}

/**
 * Get a set of letters that have available subjects
 */
export function getAvailableLetters(subjects: string[]): Set<string> {
  const letters = new Set<string>();
  
  subjects.forEach(subject => {
    const firstLetter = subject.charAt(0).toUpperCase();
    letters.add(firstLetter);
  });
  
  return letters;
}

/**
 * Get papers for a specific subject
 */
export function getPapersBySubject(
  meta: DirectoryMeta | null,
  subject: string
): Paper[] {
  if (!meta?.papers?.length || !subject) {
    return [];
  }
  
  return meta.papers.filter(paper => 
    paper.standardSubject === subject || paper.subject === subject
  );
}

/**
 * Highlight matching parts of text
 */
export function getHighlightedText(text: string, query: string): { 
  prefix: string;
  highlight: string;
  suffix: string;
} {
  if (!query) {
    return { prefix: text, highlight: '', suffix: '' };
  }
  
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return { prefix: text, highlight: '', suffix: '' };
  }
  
  return {
    prefix: text.substring(0, index),
    highlight: text.substring(index, index + query.length),
    suffix: text.substring(index + query.length)
  };
} 