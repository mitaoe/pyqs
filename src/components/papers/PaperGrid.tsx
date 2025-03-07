import type { Paper } from '@/types/paper';
import PaperCard from './PaperCard';

interface PaperGridProps {
  papers: Paper[];
  isLoading?: boolean;
  groupBySubject?: boolean;
}

export default function PaperGrid({ papers, isLoading = false, groupBySubject = false }: PaperGridProps) {
  // Remove duplicates based on fileName and url
  const uniquePapers = papers.filter((paper, index, self) =>
    index === self.findIndex(p => p.fileName === paper.fileName && p.url === paper.url)
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border border-accent bg-secondary"
          />
        ))}
      </div>
    );
  }

  if (!uniquePapers.length) {
    return (
      <div className="rounded-lg border border-accent bg-secondary p-8 text-center text-content/60">
        No papers found
      </div>
    );
  }

  if (groupBySubject) {
    const papersBySubject = uniquePapers.reduce((acc, paper) => {
      const subject = paper.subject || 'Unknown';
      if (!acc[subject]) {
        acc[subject] = [];
      }
      acc[subject].push(paper);
      return acc;
    }, {} as Record<string, Paper[]>);

    return (
      <div className="space-y-8">
        {Object.entries(papersBySubject).map(([subject, papers]) => (
          <div key={subject} className="space-y-4">
            <h3 className="text-lg font-medium text-content">{subject}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {papers.map((paper, index) => (
                <PaperCard key={`${paper.fileName}-${index}`} {...paper} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {uniquePapers.map((paper, index) => (
        <PaperCard key={`${paper.fileName}-${index}`} {...paper} />
      ))}
    </div>
  );
} 