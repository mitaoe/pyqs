import PaperCard from './PaperCard';
import type { DBPaper } from '@/types/paper';

type Paper = Pick<DBPaper, '_id' | 'fileName' | 'url' | 'year' | 'branch' | 'semester' | 'examType'>;

interface PaperGridProps {
  papers: Paper[];
  isLoading?: boolean;
}

export default function PaperGrid({ papers, isLoading = false }: PaperGridProps) {
  // Remove duplicates based on fileName and url
  const uniquePapers = papers.reduce((acc: Paper[], paper) => {
    const exists = acc.some(p => p.fileName === paper.fileName && p.url === paper.url);
    if (!exists) {
      acc.push(paper);
    }
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, index) => (
          <div
            key={`loading-skeleton-${index}`}
            className="h-[200px] animate-pulse rounded-lg border border-accent/20 bg-accent/5"
          />
        ))}
      </div>
    );
  }

  if (uniquePapers.length === 0) {
    return (
      <div className="rounded-lg border border-accent bg-secondary p-8 text-center">
        <p className="text-content/60">No papers found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {uniquePapers.map((paper) => (
        <PaperCard 
          key={paper._id || `${paper.url}-${paper.fileName}`}
          {...paper} 
        />
      ))}
    </div>
  );
} 