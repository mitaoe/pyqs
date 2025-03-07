import { useState } from 'react';
import type { Paper } from '@/types/paper';
import { DownloadIcon } from '@/components/ui/icons';
import { downloadFile } from '@/utils/download';

type PaperCardProps = Pick<Paper, 'year' | 'branch' | 'semester' | 'examType' | 'fileName' | 'url' | 'subject' | 'standardSubject'>;

export default function PaperCard({
  year,
  branch,
  semester,
  examType,
  fileName,
  url,
  subject,
  standardSubject,
}: PaperCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadFile(url, fileName);
    } finally {
      setIsDownloading(false);
    }
  };

  // Display standardSubject if available, otherwise use subject
  const displaySubject = standardSubject !== 'Unknown' ? standardSubject : subject;

  return (
    <div className="group relative rounded-lg border border-accent bg-secondary p-4 transition-all hover:border-accent/80">
      <div className="mb-4">
        <h3 className="font-medium text-content">{displaySubject}</h3>
        <p className="mt-1 text-sm text-content/60">{fileName}</p>
        <p className="mt-1 text-sm text-content/60">{year}</p>
      </div>
      
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        {branch !== 'COMMON' && (
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

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 rounded-md bg-accent/90 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DownloadIcon className={`h-4 w-4 ${isDownloading ? 'animate-spin' : ''}`} />
        <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
      </button>
    </div>
  );
} 