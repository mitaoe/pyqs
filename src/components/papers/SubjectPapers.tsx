'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePapers } from '@/contexts/PaperContext';
import { 
  GridFour, 
  List, 
  Download, 
  ArrowLeft, 
  BookOpen, 
  Copy, 
  CheckSquare, 
  Square,
  X,
  Funnel,
  Package
} from '@phosphor-icons/react';
import { downloadFile, batchDownloadPapers, BatchDownloadProgress } from '@/utils/download';
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
  const [selectedPapers, setSelectedPapers] = useState<Record<string, boolean>>({});
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    years: [] as string[],
    examTypes: [] as string[]
  });
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<BatchDownloadProgress | null>(null);

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

      // Apply additional filters if any
      let filtered = [...papersBySubject];
      
      if (filters.years.length > 0) {
        filtered = filtered.filter(paper => filters.years.includes(paper.year));
      }
      
      if (filters.examTypes.length > 0) {
        filtered = filtered.filter(paper => {
          // Map any exam type to ESE except MSE
          const normalizedExamType = paper.examType.toLowerCase() === 'mse' ? 'MSE' : 'ESE';
          return filters.examTypes.includes(normalizedExamType);
        });
      }

      // Sort papers by year (newest first)
      const sortedPapers = [...filtered].sort((a, b) => {
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
  }, [searchParams, papers, filters]);

  // Get unique years and exam types for filters
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const examTypes = new Set<string>(['ESE', 'MSE']);
    
    // Only collect unique values from papers matching the current subject
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      const subjectPapers = papers.filter(paper =>
        paper.standardSubject.toLowerCase() === subjectParam.toLowerCase() ||
        paper.subject.toLowerCase() === subjectParam.toLowerCase()
      );
      
      subjectPapers.forEach(paper => {
        years.add(paper.year);
      });
    }
    
    return {
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
      examTypes: Array.from(examTypes)
    };
  }, [searchParams, papers]);

  const selectedPapersCount = useMemo(() => {
    return Object.values(selectedPapers).filter(Boolean).length;
  }, [selectedPapers]);

  const selectedPapersArray = useMemo(() => {
    return filteredPapers.filter(paper => selectedPapers[paper.fileName]);
  }, [filteredPapers, selectedPapers]);

  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'));
  };

  const toggleSelectMode = () => {
    setIsSelectMode(prev => !prev);
    if (isSelectMode) {
      setSelectedPapers({});
    }
  };

  const togglePaperSelection = (fileName: string) => {
    setSelectedPapers(prev => ({
      ...prev,
      [fileName]: !prev[fileName]
    }));
  };

  const toggleAllPapers = () => {
    if (selectedPapersCount === filteredPapers.length) {
      // Deselect all
      setSelectedPapers({});
    } else {
      // Select all
      const newSelection: Record<string, boolean> = {};
      filteredPapers.forEach(paper => {
        newSelection[paper.fileName] = true;
      });
      setSelectedPapers(newSelection);
    }
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

  const toggleFilterItem = (key: 'years' | 'examTypes', value: string) => {
    setFilters(prev => {
      const currentValues = [...prev[key]];
      const valueIndex = currentValues.indexOf(value);
      
      if (valueIndex === -1) {
        // Add the value if it doesn't exist
        return {
          ...prev,
          [key]: [...currentValues, value]
        };
      } else {
        // Remove the value if it exists
        currentValues.splice(valueIndex, 1);
        return {
          ...prev,
          [key]: currentValues
        };
      }
    });
  };

  const clearFilters = () => {
    setFilters({
      years: [],
      examTypes: []
    });
  };

  const isAnyFilterActive = filters.years.length > 0 || filters.examTypes.length > 0;

  // Grid view
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {filteredPapers.map((paper, index) => (
        <FadeIn key={`${paper.fileName}-${index}`} delay={Math.min(index * 0.05, 0.3)} duration={0.5}>
          <div
            className={`bg-secondary border rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg h-full ${
              selectedPapers[paper.fileName] 
                ? 'border-accent' 
                : 'border-accent/40 hover:border-accent/70'
            }`}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-accent/20 rounded-lg text-xs font-medium">
                    {paper.year}
                  </span>
                  <span className="px-2 py-1 bg-primary/60 rounded-lg text-xs font-medium">
                    {paper.examType}
                  </span>
                </div>
                {isSelectMode && (
                  <button
                    onClick={() => togglePaperSelection(paper.fileName)}
                    className="text-content hover:text-accent transition-colors focus:outline-none p-1 -m-1"
                    aria-label={selectedPapers[paper.fileName] ? "Deselect paper" : "Select paper"}
                  >
                    {selectedPapers[paper.fileName] ? (
                      <CheckSquare size={22} weight="fill" className="text-accent" />
                    ) : (
                      <Square size={22} weight="regular" />
                    )}
                  </button>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-content mb-2 line-clamp-2">
                {paper.fileName}
              </h3>
            </div>
            {!isSelectMode ? (
              <button
                onClick={() => handleDownload(paper)}
                disabled={downloadingFile === paper.fileName}
                className="mt-auto w-full flex items-center justify-center gap-2 bg-accent rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium text-content transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
              >
                <Download size={18} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
                <span>{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
              </button>
            ) : (
              <button
                onClick={() => togglePaperSelection(paper.fileName)}
                className={`mt-auto w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 ${
                  selectedPapers[paper.fileName]
                    ? 'bg-accent text-content hover:bg-accent/90 focus:ring-accent/40'
                    : 'bg-primary text-content hover:bg-primary/80 focus:ring-primary/40'
                }`}
              >
                {selectedPapers[paper.fileName] ? (
                  <>
                    <CheckSquare size={18} weight="duotone" />
                    <span>Selected</span>
                  </>
                ) : (
                  <>
                    <Square size={18} weight="duotone" />
                    <span>Select</span>
                  </>
                )}
              </button>
            )}
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
            className={`flex items-center justify-between bg-secondary border rounded-xl p-3 sm:p-4 transition-all duration-300 hover:shadow-md ${
              selectedPapers[paper.fileName] 
                ? 'border-accent' 
                : 'border-accent/40 hover:border-accent/70'
            }`}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-start gap-2 sm:gap-4 max-w-[70%]">
              {isSelectMode ? (
                <button
                  onClick={() => togglePaperSelection(paper.fileName)}
                  className="flex-shrink-0 text-content hover:text-accent transition-colors focus:outline-none p-1"
                  aria-label={selectedPapers[paper.fileName] ? "Deselect paper" : "Select paper"}
                >
                  {selectedPapers[paper.fileName] ? (
                    <CheckSquare size={24} weight="fill" className="text-accent" />
                  ) : (
                    <Square size={24} weight="regular" />
                  )}
                </button>
              ) : (
                <div className="hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 min-w-10 sm:min-w-12 items-center justify-center rounded-xl bg-primary/60">
                  <BookOpen size={24} weight="duotone" className="text-content/80" />
                </div>
              )}
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
            {!isSelectMode ? (
              <button
                onClick={() => handleDownload(paper)}
                disabled={downloadingFile === paper.fileName}
                className="flex items-center gap-1 sm:gap-2 bg-accent rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-content transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 ml-2 sm:ml-4"
              >
                <Download size={18} weight="duotone" className={downloadingFile === paper.fileName ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{downloadingFile === paper.fileName ? 'Downloading...' : 'Download'}</span>
              </button>
            ) : (
              <button
                onClick={() => togglePaperSelection(paper.fileName)}
                className={`flex items-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 ml-2 sm:ml-4 ${
                  selectedPapers[paper.fileName]
                    ? 'bg-accent text-content hover:bg-accent/90 focus:ring-accent/40'
                    : 'bg-primary text-content hover:bg-primary/80 focus:ring-primary/40'
                }`}
              >
                {selectedPapers[paper.fileName] ? (
                  <>
                    <CheckSquare size={16} weight="duotone" />
                    <span className="hidden sm:inline">Selected</span>
                  </>
                ) : (
                  <>
                    <Square size={16} weight="duotone" />
                    <span className="hidden sm:inline">Select</span>
                  </>
                )}
              </button>
            )}
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
          <p className="text-content/60 mb-4 sm:mb-6 max-w-md text-sm sm:text-base">
            {isAnyFilterActive 
              ? 'No papers match the current filters. Try changing or clearing the filters.' 
              : `We couldn't find any papers for ${selectedSubject || 'this subject'}. Please try another subject.`}
          </p>
          {isAnyFilterActive ? (
            <button
              onClick={clearFilters}
              className="bg-accent text-content px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 font-medium"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => router.push('/papers')}
              className="bg-accent text-content px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 font-medium"
            >
              Back to Subjects
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render batch download progress overlay
  const renderBatchDownloadProgress = () => {
    if (!batchDownloadProgress) return null;

    const getStatusText = () => {
      switch (batchDownloadProgress.status) {
        case 'preparing':
          return 'Preparing download...';
        case 'downloading':
          return 'Downloading papers...';
        case 'processing':
          return 'Creating ZIP file...';
        case 'complete':
          return 'Download complete!';
        case 'error':
          return batchDownloadProgress.error || 'Download failed';
        default:
          return 'Processing...';
      }
    };

    const getProgressPercentage = () => {
      if (batchDownloadProgress.status === 'complete') return 100;
      if (batchDownloadProgress.status === 'error') return 0;
      if (batchDownloadProgress.status === 'preparing') return 5;
      if (batchDownloadProgress.status === 'downloading') return 30;
      if (batchDownloadProgress.status === 'processing') return 70;
      return 0;
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-secondary rounded-xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-content">
              {batchDownloadProgress.status === 'complete' ? 'Download Complete' : 'Downloading Papers'}
            </h3>
            {(batchDownloadProgress.status === 'complete' || batchDownloadProgress.status === 'error') && (
              <button 
                onClick={() => setBatchDownloadProgress(null)}
                className="text-content/60 hover:text-content"
                aria-label="Close"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
          
          <div className="mb-4">
            <div className="h-2 bg-primary/30 rounded-full overflow-hidden">
              <div 
                className={`h-full ${batchDownloadProgress.status === 'error' ? 'bg-red-500' : 'bg-accent'} transition-all duration-500`} 
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-content/80 text-center mb-2">{getStatusText()}</p>
          
          {batchDownloadProgress.status === 'error' && (
            <div className="mt-4 text-center">
              <button
                onClick={handleBatchDownload}
                className="bg-accent text-content px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 hover:bg-accent/90 focus:outline-none"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render filter dropdown
  const renderFilterDropdown = () => {
    if (!showFilters) return null;

    return (
      <div className="absolute right-0 top-full mt-2 bg-secondary border border-accent/30 rounded-xl shadow-lg p-4 z-30 w-64">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-content">Filters</h3>
          <button
            onClick={() => setShowFilters(false)}
            className="text-content/60 hover:text-content p-1"
            aria-label="Close filters"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        
        {/* Year filter - Updated for multi-select */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-content/70 mb-2">Year</h4>
          <div className="flex flex-wrap gap-2">
            {filterOptions.years.map(year => (
              <button
                key={year}
                onClick={() => toggleFilterItem('years', year)}
                className={`px-2 py-1 text-xs rounded-lg ${
                  filters.years.includes(year)
                    ? 'bg-accent text-content'
                    : 'bg-primary/40 text-content/80 hover:bg-primary/60'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
        
        {/* Exam Type filter - Updated for multi-select */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-content/70 mb-2">Exam Type</h4>
          <div className="flex gap-2">
            {filterOptions.examTypes.map(examType => (
              <button
                key={examType}
                onClick={() => toggleFilterItem('examTypes', examType)}
                className={`px-2 py-1 text-xs rounded-lg ${
                  filters.examTypes.includes(examType)
                    ? 'bg-accent text-content'
                    : 'bg-primary/40 text-content/80 hover:bg-primary/60'
                }`}
              >
                {examType}
              </button>
            ))}
          </div>
        </div>
        
        {isAnyFilterActive && (
          <button
            onClick={clearFilters}
            className="w-full text-xs bg-primary/60 hover:bg-primary/80 text-content py-1.5 rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  };

  const handleBatchDownload = async () => {
    if (selectedPapersArray.length === 0) {
      toast.error('No papers selected for download');
      return;
    }

    // Reset any previous progress
    setBatchDownloadProgress({
      totalPapers: selectedPapersArray.length,
      completed: 0,
      status: 'preparing'
    });

    // Attempt the batch download with filter information
    await batchDownloadPapers(selectedPapersArray, filters, (progress) => {
      setBatchDownloadProgress(progress);
      
      // If complete or error, clear progress after a delay
      if (progress.status === 'complete' || progress.status === 'error') {
        setTimeout(() => {
          setBatchDownloadProgress(null);
          
          // If download was successful, exit select mode
          if (progress.status === 'complete') {
            setIsSelectMode(false);
            setSelectedPapers({});
          }
        }, 3000);
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 relative">
      {/* Sticky header with Back button, subject title, and action buttons */}
      <div className="sticky top-0 z-20 bg-secondary/90 backdrop-blur-lg px-3 sm:px-4 py-3 sm:py-4 rounded-xl flex flex-col mb-6 sm:mb-8 shadow-md">
        {/* Top row: Back button and subject title, select toggle */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
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
              onClick={toggleSelectMode}
              className={`p-2 sm:p-2.5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 ${
                isSelectMode 
                  ? 'bg-accent text-content hover:bg-accent/90 focus:ring-accent/40' 
                  : 'bg-primary/60 text-content hover:bg-primary/70 focus:ring-primary/40'
              }`}
              aria-label={isSelectMode ? "Exit selection mode" : "Enter selection mode"}
            >
              {isSelectMode ? <X size={18} weight="bold" /> : <CheckSquare size={18} weight="bold" />}
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className={`p-2 sm:p-2.5 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 ${
                  isAnyFilterActive || showFilters
                    ? 'bg-accent text-content hover:bg-accent/90 focus:ring-accent/40' 
                    : 'bg-primary/60 text-content hover:bg-primary/70 focus:ring-primary/40'
                }`}
                aria-label="Show filters"
              >
                <Funnel size={18} weight={isAnyFilterActive ? "fill" : "bold"} />
              </button>
              {renderFilterDropdown()}
            </div>
          </div>
        </div>
        
        {/* Bottom row: Paper count, view toggle, and copy button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isSelectMode ? (
              <button
                onClick={toggleAllPapers}
                className="text-sm text-content/80 hover:text-content flex items-center gap-1.5 py-1"
              >
                {selectedPapersCount === filteredPapers.length && filteredPapers.length > 0 ? (
                  <>
                    <Square size={15} weight="bold" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={15} weight="bold" />
                    <span>Select All</span>
                  </>
                )}
              </button>
            ) : (
              <span className="text-xs sm:text-sm text-content/80">{filteredPapers.length} papers</span>
            )}

            {isSelectMode && selectedPapersCount > 0 && (
              <span className="ml-3 text-sm bg-accent/20 text-accent rounded-full px-2 py-0.5">
                {selectedPapersCount} selected
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2 sm:p-2.5 rounded-lg bg-primary/60 text-content hover:bg-primary/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Copy link to this subject"
            >
              <Copy size={18} weight="bold" />
            </button>
            
            <button
              onClick={toggleViewMode}
              className="p-2 sm:p-2.5 rounded-lg bg-primary/60 text-content hover:bg-primary/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Toggle view mode"
            >
              {viewMode === 'grid' ? <List size={18} weight="bold" /> : <GridFour size={18} weight="bold" />}
            </button>
          </div>
        </div>
      </div>

      {/* Display papers */}
      <FadeIn>
        {viewMode === 'grid' ? renderGridView() : renderListView()}
      </FadeIn>

      {/* Batch download floating button */}
      {isSelectMode && selectedPapersCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <button
            onClick={handleBatchDownload}
            className="bg-accent text-content px-4 py-3 sm:px-6 sm:py-3.5 rounded-xl shadow-lg transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 flex items-center gap-2"
          >
            <Package size={20} weight="duotone" />
            <span>Download {selectedPapersCount} Papers</span>
          </button>
        </div>
      )}

      {/* Batch download progress overlay */}
      {batchDownloadProgress && renderBatchDownloadProgress()}
    </div>
  );
};

export default SubjectPapersView;
