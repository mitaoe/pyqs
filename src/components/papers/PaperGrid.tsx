import type { Paper } from '@/types/paper';
import PaperCard from './PaperCard';

interface PaperGridProps {
  papers: Paper[];
  isLoading?: boolean;
}

export default function PaperGrid({ papers, isLoading = false }: PaperGridProps) {
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {uniquePapers.map((paper, index) => (
        <PaperCard key={`${paper.fileName}-${index}`} {...paper} />
      ))}
    </div>
  );
} 