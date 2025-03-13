'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { GridFour, List, Download, ArrowLeft, BookOpen, Copy } from '@phosphor-icons/react';
import { downloadFile } from '@/utils/download';
import { Paper } from '@/types/paper';
import FadeIn from '@/components/animations/FadeIn';
import { toast } from 'sonner';

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
  const { papers, dataReady } = usePapers();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkScreenSize = () => {
      if (typeof window !== 'undefined') {
        setViewMode(window.innerWidth < 640 ? 'list' : 'grid');
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    // Simulate loading state for smooth transition
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

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

      // Sort papers by year (newest first)
      const sortedPapers = [...papersBySubject].sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        return yearB - yearA;
      });

      const uniquePapers = Array.from(
        new Map(sortedPapers.map(paper => [paper.fileName, paper]))
          .values()
      );

      return uniquePapers;
    }
    return [];
  }, [searchParams, papers]);

  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'));
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
        .then(() => toast.success('Link copied to clipboard'))
        .catch(() => toast.error('Failed to copy link'));
    }
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

  // Grid view
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {filteredPapers.map((paper, index) => (
        <FadeIn key={`${paper.fileName}-${index}`} delay={Math.min(index * 0.05, 0.3)} duration={0.5}>
          <div
            className="bg-secondary border border-accent/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-accent/70 h-full"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="mb-4">
              <div className="flex items-start gap-2 mb-3 flex-wrap">
                <span className="px-2 py-1 bg-accent/20 rounded-lg text-xs font-medium">
                  {paper.year}
                </span>
                <span className="px-2 py-1 bg-primary/60 rounded-lg text-xs font-medium">
                  {paper.examType}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-content mb-2 line-clamp-2">
                {paper.fileName}
              </h3>
            </div>
            <button
              onClick={() => handleDownload(paper)}
              disabled={downloadingFile === paper.fileName}
              className="mt-auto w-full flex items-center justify-center gap-2 bg-accent rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium text-content transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
            >
              <Download size={18} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
              <span>{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
            </button>
          </div>
        </FadeIn>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-3 sm:space-y-4">
      {filteredPapers.map((paper, index) => (
        <FadeIn key={`${paper.fileName}-${index}`} delay={Math.min(index * 0.03, 0.2)} duration={0.4}>
          <div
            className="flex items-center justify-between bg-secondary border border-accent/40 rounded-xl p-3 sm:p-4 transition-all duration-300 hover:shadow-md hover:border-accent/70"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-start gap-2 sm:gap-4 max-w-[70%]">
              <div className="hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 min-w-10 sm:min-w-12 items-center justify-center rounded-xl bg-primary/60">
                <BookOpen size={24} weight="duotone" className="text-content/80" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="flex flex-wrap gap-1 sm:gap-2 mb-1">
                  <span className="px-1.5 sm:px-2 py-0.5 bg-accent/20 rounded-lg text-xs font-medium whitespace-nowrap">
                    {paper.year}
                  </span>
                  <span className="px-1.5 sm:px-2 py-0.5 bg-primary/60 rounded-lg text-xs font-medium whitespace-nowrap">
                    {paper.examType}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-content truncate sm:text-lg">
                  {paper.fileName}
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleDownload(paper)}
              disabled={downloadingFile === paper.fileName}
              className="flex items-center gap-1 sm:gap-2 bg-accent rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-content transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 ml-2 sm:ml-4"
            >
              <Download size={18} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
            </button>
          </div>
        </FadeIn>
      ))}
    </div>
  );

  // Loading state
  if (isLoading || !dataReady) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center justify-center h-[50vh] sm:h-[60vh]">
          <div className="animate-pulse w-16 h-16 sm:w-20 sm:h-20 bg-accent/20 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={28} weight="duotone" className="text-accent/40" />
          </div>
          <p className="text-content/60 text-base sm:text-lg">Loading papers...</p>
        </div>
      </div>
    );
  }

  // Fallback if no papers match the subject
  if (!filteredPapers.length) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center justify-center h-[50vh] sm:h-[60vh] text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-accent/10 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={28} weight="duotone" className="text-accent/40" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">No papers found</h3>
          <p className="text-content/60 mb-4 sm:mb-6 max-w-md text-sm sm:text-base">We couldn&apos;t find any papers for {selectedSubject || 'this subject'}. Please try another subject.</p>
          <button
            onClick={() => router.push('/papers')}
            className="bg-accent text-content px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 font-medium"
          >
            Back to Subjects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 relative">
      {/* Sticky header with Back button, subject title, and view toggle */}
      <div className="sticky top-0 z-20 bg-secondary/90 backdrop-blur-lg px-3 sm:px-4 py-3 sm:py-4 rounded-xl flex items-center justify-between mb-6 sm:mb-8 shadow-md">
        <div className="flex items-center gap-2 sm:gap-4 max-w-[60%]">
          <button
            onClick={() => router.push('/papers')}
            className="p-2 sm:p-2.5 rounded-lg bg-accent text-content hover:bg-accent/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Back to Subjects"
          >
            <ArrowLeft size={18} weight="bold" />
          </button>
          <h2 className="text-lg sm:text-2xl font-bold text-content truncate">{selectedSubject}</h2>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleCopyLink}
            className="p-2 sm:p-2.5 rounded-lg bg-secondary text-content hover:bg-secondary/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 border border-accent/30"
            aria-label="Copy link to this subject"
          >
            <Copy size={18} weight="bold" />
          </button>
          <span className="text-xs sm:text-sm text-content/60 mx-1 sm:mx-2">{filteredPapers.length} papers</span>
          <button
            onClick={toggleViewMode}
            className="p-2 sm:p-2.5 rounded-lg bg-accent text-content hover:bg-accent/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Toggle view mode"
          >
            {viewMode === 'grid' ? <List size={18} weight="bold" /> : <GridFour size={18} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Display papers */}
      <FadeIn>
        {viewMode === 'grid' ? renderGridView() : renderListView()}
      </FadeIn>
    </div>
  );
};

export default SubjectPapersView;
