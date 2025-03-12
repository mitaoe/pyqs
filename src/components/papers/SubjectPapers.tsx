'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { GridFour, List, Download, ArrowLeft } from '@phosphor-icons/react';
import { downloadFile } from '@/utils/download';
import { Paper } from '@/types/paper';

// Utility function to trim redundant URL paths
const trimRedundantUrlPath = (url: string): string => {
  try {
    const urlParts = url.split('/');
    const uniqueParts = urlParts.filter((part, index, arr) => 
      index === arr.indexOf(part)
    );
    return uniqueParts.join('/');
  } catch (error) {
    console.error('URL trimming failed:', error);
    return url;
  }
};

const SubjectPapersView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { papers } = usePapers();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Get the subject parameter from URL and filter papers
  const filteredPapers = useMemo(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setSelectedSubject(subjectParam);
      // Filter papers by subject and remove duplicates based on fileName
      const papersBySubject = papers.filter(paper =>
        paper.standardSubject.toLowerCase() === subjectParam.toLowerCase() ||
        paper.subject.toLowerCase() === subjectParam.toLowerCase()
      );

      const uniquePapers = Array.from(
        new Map(papersBySubject.map(paper => [paper.fileName, paper]))
          .values()
      );

      return uniquePapers;
    }
    return [];
  }, [searchParams, papers]);

  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'));
  };

  const handleDownload = async (paper: Paper) => {
    if (downloadingFile) return;
    setDownloadingFile(paper.fileName);
    try {
      // Trim the redundant URL path before downloading
      const trimmedUrl = trimRedundantUrlPath(paper.url);
      await downloadFile(trimmedUrl, paper.fileName);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingFile(null);
    }
  };

  // Grid view: responsive card layout
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredPapers.map((paper, index) => (
        <div
          key={`${paper.fileName}-${index}`} // Use unique key with index
          className="bg-secondary border border-accent rounded-lg p-4 flex flex-col justify-between transition-transform duration-200 hover:scale-105"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div>
            <h3 className="text-lg font-medium text-content mb-2 truncate">{paper.fileName}</h3>
            <p className="text-sm text-content/80">{paper.year} • {paper.examType}</p>
          </div>
          <button
            onClick={() => handleDownload(paper)}
            disabled={downloadingFile === paper.fileName}
            className="mt-4 flex items-center gap-2 bg-accent rounded-full px-3 py-1.5 text-sm font-medium text-content transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
          >
            <Download size={20} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
            <span>{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {filteredPapers.map((paper, index) => (
        <div
          key={`${paper.fileName}-${index}`} // Use unique key with index
          className="flex items-center justify-between bg-secondary border border-accent rounded-lg p-4 transition-transform duration-200 hover:scale-105"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col">
            <h3 className="text-lg font-medium text-content truncate">{paper.fileName}</h3>
            <p className="text-sm text-content/80 mt-1">{paper.year} • {paper.examType}</p>
          </div>
          <button
            onClick={() => handleDownload(paper)}
            disabled={downloadingFile === paper.fileName}
            className="flex items-center gap-2 bg-accent rounded-full px-3 py-1.5 text-sm font-medium text-content transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
          >
            <Download size={20} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
            <span>{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      ))}
    </div>
  );

  // Fallback if no papers match the subject
  if (!filteredPapers.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center h-full py-8">
          <p className="text-content/60 mb-4">No papers found for this subject.</p>
          <button
            onClick={() => router.push('/papers')}
            className="bg-accent text-content px-4 py-2 rounded-md transition-transform duration-200 hover:scale-105 focus:outline-none"
          >
            Back to Subjects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Sticky header with Back button, subject title, and view toggle */}
      <div className="sticky top-0 z-20 bg-secondary px-4 py-3 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/papers')}
            className="p-2 rounded-md bg-accent text-content focus:outline-none"
            aria-label="Back to Subjects"
          >
            <ArrowLeft size={20} weight="duotone" />
          </button>
          <h2 className="text-2xl font-semibold text-content truncate">{selectedSubject}</h2>
        </div>
        <button
          onClick={toggleViewMode}
          className="p-2 rounded-md bg-accent text-content focus:outline-none"
          aria-label="Toggle view mode"
        >
          {viewMode === 'grid' ? <GridFour size={24} weight="duotone" /> : <List size={24} weight="duotone" />}
        </button>
      </div>

      {/* Papers display */}
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
};

export default SubjectPapersView;
