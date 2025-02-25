import type { Paper } from '@/types/paper';
import { DownloadIcon } from '@/components/ui/icons';

type PaperCardProps = Pick<Paper, 'year' | 'branch' | 'semester' | 'examType' | 'fileName' | 'url'>;

export default function PaperCard({
  year,
  branch,
  semester,
  examType,
  fileName,
  url,
}: PaperCardProps) {
  return (
    <div className="group relative rounded-lg border border-accent bg-secondary p-4 transition-all hover:border-accent/80">
      <div className="mb-4">
        <h3 className="font-medium text-content">{fileName}</h3>
        <p className="mt-1 text-sm text-content/60">{year}</p>
      </div>
      
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        {branch && (
          <div>
            <span className="text-content/60">Branch:</span>
            <span className="ml-1 text-content">{branch}</span>
          </div>
        )}
        {semester && (
          <div>
            <span className="text-content/60">Semester:</span>
            <span className="ml-1 text-content">{semester}</span>
          </div>
        )}
        {examType && (
          <div>
            <span className="text-content/60">Exam:</span>
            <span className="ml-1 text-content">{examType}</span>
          </div>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <DownloadIcon className="h-4 w-4" />
        <span>Download</span>
      </a>
    </div>
  );
} 