import { useState, useEffect } from 'react';
import { X, Download, Spinner } from '@phosphor-icons/react';
import { Paper } from '@/types/paper';
import { downloadFile } from '@/utils/download';

interface PaperViewerProps {
  paper: Paper | null;
  onClose: () => void;
}

const PaperViewer = ({ paper, onClose }: PaperViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!paper) return;

    const fetchPaper = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the paper content
        const response = await fetch(`/api/papers/view?url=${encodeURIComponent(paper.url)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch paper');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load paper');
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();

    // Cleanup
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [paper]);

  const handleDownload = async () => {
    if (!paper) return;
    try {
      await downloadFile(paper.url, paper.fileName);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!paper) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-secondary rounded-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-accent/20">
          <h2 className="text-lg font-semibold text-content truncate">
            {paper.fileName}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-content/80 hover:text-content transition-colors"
              title="Download"
            >
              <Download size={20} weight="bold" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-content/80 hover:text-content transition-colors"
              title="Close"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Spinner size={32} className="animate-spin text-accent" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-lg"
              title={paper.fileName}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PaperViewer; 