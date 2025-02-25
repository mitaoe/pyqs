import PaperCard from './PaperCard';
import type { DBPaper } from '@/types/paper';

type Paper = Pick<DBPaper, '_id' | 'fileName' | 'url' | 'year' | 'branch' | 'semester' | 'examType'>;

interface PaperGridProps {
  papers: Paper[];
  isLoading?: boolean;
}

export default function PaperGrid({ papers, isLoading = false }: PaperGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No papers found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {papers.map((paper) => (
        <PaperCard key={paper._id} {...paper} />
      ))}
    </div>
  );
} 