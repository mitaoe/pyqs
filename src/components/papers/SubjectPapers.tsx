"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePapers } from "@/contexts/PaperContext";
import Image from "next/image";
import {
  GridFour,
  List,
  Download,
  ArrowLeft,
  FileText,
  CheckSquare,
  Square,
  X,
  Funnel,
  FileZip,
  Eye,
} from "@phosphor-icons/react";
import {
  downloadFile,
  batchDownloadPapers,
  BatchDownloadProgress,
} from "@/utils/download";
import { Paper } from "@/types/paper";
import FadeIn from "@/components/animations/FadeIn";
import { toast } from "sonner";
import { usePDFPreview } from "@/hooks/usePDFPreview";
import PDFPreviewModal from "@/components/pdf/PDFPreviewModal";

const SubjectPapersView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { papers, dataReady, meta } = usePapers();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const {
    isOpen: isPDFOpen,
    currentPaper,
    papers: pdfPapers,
    openPreview,
    closePreview,
    navigateToPaper,
  } = usePDFPreview();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPapers, setSelectedPapers] = useState<Record<string, boolean>>(
    {}
  );
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    years: [] as string[],
    examTypes: [] as string[],
  });
  const [batchDownloadProgress, setBatchDownloadProgress] =
    useState<BatchDownloadProgress | null>(null);
  const [showSelectTuto, setShowSelectTuto] = useState(false);
  const previousSubjectRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const hasSeenTuto = localStorage.getItem("papers_select_tutorial_seen");
      if (!hasSeenTuto) {
        const timer = setTimeout(() => {
          setShowSelectTuto(true);
        }, 1500); // Show after 1.5 seconds
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.warn("Failed to read from localStorage:", error);
      // Fallback: show tutorial if localStorage fails
      const timer = setTimeout(() => {
        setShowSelectTuto(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismissTuto = () => {
    setShowSelectTuto(false);
    try {
      localStorage.setItem("papers_select_tutorial_seen", "true");
    } catch (error) {
      console.warn("Failed to save to localStorage:", error);
      // Continue without saving - tutorial will show again next time
    }
  };

  const scrollToTop = () => {
    window.scrollTo(0, 0);

    const scrollContainer = document.getElementById("scrollable-content");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  };

  useEffect(() => {
    if (dataReady && meta?.standardSubjects) {
      const subjectParam = searchParams.get("subject");

      if (subjectParam) {
        if (
          previousSubjectRef.current !== null &&
          previousSubjectRef.current !== subjectParam
        ) {
          scrollToTop();
        }
        previousSubjectRef.current = subjectParam;
      }

      if (
        subjectParam &&
        !meta.standardSubjects.some(
          (subject) => subject.toLowerCase() === subjectParam.toLowerCase()
        )
      ) {
        toast.error(`Subject "${subjectParam}" not found`, {
          description: "Redirecting to the subject list",
          duration: 4000,
        });

        setTimeout(() => {
          router.push("/papers");
        }, 1500);
      }
    }
  }, [searchParams, dataReady, meta, router]);

  // When component mounts, ensure we're at the top of the page
  useEffect(() => {
    scrollToTop();
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      if (typeof window !== "undefined") {
        setViewMode(window.innerWidth < 640 ? "list" : "grid");
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
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
    const subjectParam = searchParams.get("subject");
    if (subjectParam) {
      setSelectedSubject(subjectParam);
      // Filter papers by subject and remove duplicates based on fileName
      const papersBySubject = papers.filter(
        (paper) =>
          paper.standardSubject.toLowerCase() === subjectParam.toLowerCase() ||
          paper.subject.toLowerCase() === subjectParam.toLowerCase()
      );

      // Apply additional filters if any
      let filtered = [...papersBySubject];

      if (filters.years.length > 0) {
        filtered = filtered.filter((paper) =>
          filters.years.includes(paper.year)
        );
      }

      if (filters.examTypes.length > 0) {
        filtered = filtered.filter((paper) => {
          // Map any exam type to ESE except MSE
          const normalizedExamType =
            paper.examType.toLowerCase() === "mse" ? "MSE" : "ESE";
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
        new Map(sortedPapers.map((paper) => [paper.fileName, paper])).values()
      );

      return uniquePapers;
    }
    return [];
  }, [searchParams, papers, filters]);

  // Get unique years and exam types for filters
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const examTypes = new Set<string>(["ESE", "MSE"]);

    // Only collect unique values from papers matching the current subject
    const subjectParam = searchParams.get("subject");
    if (subjectParam) {
      const subjectPapers = papers.filter(
        (paper) =>
          paper.standardSubject.toLowerCase() === subjectParam.toLowerCase() ||
          paper.subject.toLowerCase() === subjectParam.toLowerCase()
      );

      subjectPapers.forEach((paper) => {
        years.add(paper.year);
      });
    }

    return {
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
      examTypes: Array.from(examTypes),
    };
  }, [searchParams, papers]);

  const selectedPapersCount = useMemo(() => {
    return Object.values(selectedPapers).filter(Boolean).length;
  }, [selectedPapers]);

  const selectedPapersArray = useMemo(() => {
    return filteredPapers.filter((paper) => selectedPapers[paper.fileName]);
  }, [filteredPapers, selectedPapers]);

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "grid" ? "list" : "grid"));
  };

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    if (isSelectMode) {
      setSelectedPapers({});
    }
  };

  const togglePaperSelection = (fileName: string) => {
    setSelectedPapers((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  const toggleAllPapers = () => {
    if (selectedPapersCount === filteredPapers.length) {
      // Deselect all
      setSelectedPapers({});
    } else {
      // Select all
      const newSelection: Record<string, boolean> = {};
      filteredPapers.forEach((paper) => {
        newSelection[paper.fileName] = true;
      });
      setSelectedPapers(newSelection);
    }
  };

  const handleDownload = async (paper: Paper) => {
    if (downloadingFile) return;
    setDownloadingFile(paper.fileName);
    try {
      await downloadFile(paper.url, paper.fileName);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloadingFile(null);
    }
  };

  const handlePreview = (paper: Paper) => {
    openPreview(paper, filteredPapers);
  };

  const toggleFilterItem = (key: "years" | "examTypes", value: string) => {
    setFilters((prev) => {
      const currentValues = [...prev[key]];
      const valueIndex = currentValues.indexOf(value);

      if (valueIndex === -1) {
        // Add the value if it doesn't exist
        return {
          ...prev,
          [key]: [...currentValues, value],
        };
      } else {
        // Remove the value if it exists
        currentValues.splice(valueIndex, 1);
        return {
          ...prev,
          [key]: currentValues,
        };
      }
    });
  };

  const clearFilters = () => {
    setFilters({
      years: [],
      examTypes: [],
    });
  };

  const isAnyFilterActive =
    filters.years.length > 0 || filters.examTypes.length > 0;

  // Add new useEffect to update selected papers when filters change
  useEffect(() => {
    if (isSelectMode) {
      const newSelection: Record<string, boolean> = {};

      filteredPapers.forEach((paper) => {
        if (selectedPapers[paper.fileName]) {
          newSelection[paper.fileName] = true;
        }
      });

      const currentSelectedCount = Object.keys(selectedPapers).length;
      const newSelectedCount = Object.keys(newSelection).length;

      if (currentSelectedCount !== newSelectedCount) {
        setSelectedPapers(newSelection);
      } else if (currentSelectedCount > 0) {
        const hasChanges = Object.keys(newSelection).some(
          (key) => !selectedPapers[key]
        );
        if (hasChanges) {
          setSelectedPapers(newSelection);
        }
      }
    }
  }, [filters, isSelectMode, filteredPapers, selectedPapers]);

  // Grid view
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
      {filteredPapers.map((paper, index) => (
        <FadeIn
          key={`${paper.fileName}-${index}`}
          delay={Math.min(index * 0.05, 0.3)}
          duration={0.5}
        >
          <div
            className={`bg-secondary border-2 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg h-full ${
              selectedPapers[paper.fileName]
                ? "border-brand shadow-md shadow-brand/20"
                : "border-accent/30 hover:border-accent/50"
            } ${isSelectMode ? "cursor-pointer" : ""}`}
            onClick={
              isSelectMode
                ? () => togglePaperSelection(paper.fileName)
                : undefined
            }
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-accent/20 rounded-md text-xs font-medium">
                    {paper.year}
                  </span>
                  <span className="px-2 py-1 bg-primary/60 rounded-md text-xs font-medium">
                    {paper.examType}
                  </span>
                </div>
                {isSelectMode && (
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors duration-200 ${
                      selectedPapers[paper.fileName]
                        ? "bg-blue-600 text-white"
                        : "bg-primary/40 text-content/80"
                    }`}
                  >
                    {selectedPapers[paper.fileName] ? (
                      <CheckSquare size={14} weight="fill" />
                    ) : (
                      <Square size={14} weight="regular" />
                    )}
                  </div>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-medium text-content mb-2 line-clamp-2 leading-tight">
                {paper.fileName}
              </h3>
            </div>
            {!isSelectMode ? (
              <div className="mt-auto flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(paper);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                >
                  <Eye size={16} weight="duotone" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(paper);
                  }}
                  disabled={downloadingFile === paper.fileName}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
                >
                  <Download
                    size={16}
                    weight="duotone"
                    className={
                      downloadingFile === paper.fileName ? "animate-spin" : ""
                    }
                  />
                  <span>
                    {downloadingFile === paper.fileName
                      ? "Downloading..."
                      : "Download"}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </FadeIn>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-3 sm:space-y-4">
      {filteredPapers.map((paper, index) => (
        <FadeIn
          key={`${paper.fileName}-${index}`}
          delay={Math.min(index * 0.03, 0.2)}
          duration={0.4}
        >
          <div
            className={`flex items-center justify-between bg-secondary border-2 rounded-xl p-3 sm:p-4 transition-all duration-300 hover:shadow-md ${
              selectedPapers[paper.fileName]
                ? "border-brand shadow-sm shadow-brand/20"
                : "border-accent/30 hover:border-accent/50"
            } ${isSelectMode ? "cursor-pointer" : ""}`}
            onClick={
              isSelectMode
                ? () => togglePaperSelection(paper.fileName)
                : undefined
            }
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-3 sm:gap-4 max-w-[70%]">
              {isSelectMode ? (
                <div
                  className={`w-5 h-5 flex-shrink-0 rounded flex items-center justify-center transition-colors duration-200 ${
                    selectedPapers[paper.fileName]
                      ? "bg-brand text-white"
                      : "bg-primary/40 text-content/80"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePaperSelection(paper.fileName);
                  }}
                >
                  {selectedPapers[paper.fileName] ? (
                    <CheckSquare size={14} weight="fill" />
                  ) : (
                    <Square size={14} weight="regular" />
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/60 flex-shrink-0">
                  <FileText
                    size={20}
                    weight="duotone"
                    className="text-content/80"
                  />
                </div>
              )}
              <div className="flex flex-col overflow-hidden min-w-0">
                <div className="flex flex-wrap gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-accent/20 rounded-md text-xs font-medium whitespace-nowrap">
                    {paper.year}
                  </span>
                  <span className="px-2 py-0.5 bg-primary/60 rounded-md text-xs font-medium whitespace-nowrap">
                    {paper.examType}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-content truncate">
                  {paper.fileName}
                </h3>
              </div>
            </div>
            {!isSelectMode ? (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(paper);
                  }}
                  className="flex items-center gap-2 bg-gray-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                >
                  <Eye size={16} weight="duotone" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(paper);
                  }}
                  disabled={downloadingFile === paper.fileName}
                  className="flex items-center gap-2 bg-brand text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
                >
                  <Download
                    size={16}
                    weight="duotone"
                    className={
                      downloadingFile === paper.fileName ? "animate-spin" : ""
                    }
                  />
                  <span className="hidden sm:inline">
                    {downloadingFile === paper.fileName
                      ? "Downloading..."
                      : "Download"}
                  </span>
                </button>
              </div>
            ) : null}
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
            <FileText size={28} weight="duotone" className="text-accent/40" />
          </div>
          <p className="text-content/60 text-base sm:text-lg">
            Loading papers...
          </p>
        </div>
      </div>
    );
  }

  // Render filter dropdown
  const renderFilterDropdown = () => {
    if (!showFilters) return null;

    return (
      <div className="absolute right-0 top-full mt-2 bg-secondary border border-accent/50 rounded-xl shadow-lg p-4 z-30 w-64">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-content">Filters</h3>
          <button
            onClick={() => setShowFilters(false)}
            className="text-content/60 hover:text-brand p-1"
            aria-label="Close filters"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Year filter - Updated for multi-select */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-content/70 mb-2">Year</h4>
          <div className="flex flex-wrap gap-2">
            {filterOptions.years.map((year) => (
              <button
                key={year}
                onClick={() => toggleFilterItem("years", year)}
                className={`px-2 py-1 text-xs rounded-md ${
                  filters.years.includes(year)
                    ? "bg-brand text-white"
                    : "bg-secondary hover:bg-brand/10 hover:text-brand"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Exam Type filter - Updated for multi-select */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-content/70 mb-2">
            Exam Type
          </h4>
          <div className="flex gap-2">
            {filterOptions.examTypes.map((examType) => (
              <button
                key={examType}
                onClick={() => toggleFilterItem("examTypes", examType)}
                className={`px-2 py-1 text-xs rounded-md ${
                  filters.examTypes.includes(examType)
                    ? "bg-brand text-white"
                    : "bg-secondary hover:bg-brand/10 hover:text-brand"
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
            className="w-full text-xs bg-secondary hover:bg-brand/10 hover:text-brand py-1.5 rounded-md transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  };

  // Fallback if no papers match the subject
  if (!filteredPapers.length) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
        {/* Sticky header with Back button, subject title, and action buttons */}
        <div className="sticky top-0 z-20 bg-primary/80 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-4 rounded-xl flex flex-col mb-6 sm:mb-8 shadow-sm border border-accent/50">
          {/* Top row: Back button, subject title, selection toggle, filter toggle */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-3 sm:gap-4 max-w-[80%] sm:max-w-[60%]">
              <button
                onClick={() => router.push("/papers")}
                className="p-2 sm:p-2.5 rounded-lg bg-secondary text-content/80 transition-colors hover:text-brand"
                aria-label="Back to Subjects"
              >
                <ArrowLeft size={18} weight="bold" />
              </button>
              <h2 className="text-lg sm:text-2xl font-bold text-content truncate">
                {selectedSubject}
              </h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowFilters((prev) => !prev)}
                  className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
                    isAnyFilterActive || showFilters
                      ? "bg-brand text-white"
                      : "bg-secondary text-content/80 hover:text-brand"
                  }`}
                  aria-label="Show filters"
                >
                  <Funnel
                    size={16}
                    weight={isAnyFilterActive ? "fill" : "bold"}
                  />
                </button>
                {renderFilterDropdown()}
              </div>
            </div>
          </div>

          {/* Bottom row: Paper count and filter controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-xs sm:text-sm text-content/80">
                0 papers
              </span>
            </div>

            {/* Mobile only action buttons in second row */}
            <div className="flex sm:hidden items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowFilters((prev) => !prev)}
                  className={`p-2 rounded-lg transition-colors ${
                    isAnyFilterActive || showFilters
                      ? "bg-brand text-white"
                      : "bg-secondary text-content/80 hover:text-brand"
                  }`}
                  aria-label="Show filters"
                >
                  <Funnel
                    size={16}
                    weight={isAnyFilterActive ? "fill" : "bold"}
                  />
                </button>
                {renderFilterDropdown()}
              </div>
            </div>
          </div>
        </div>

        {/* No papers found content with image */}
        <div className="flex flex-col items-center justify-center mt-8 sm:mt-12">
          <Image
            src="/images/not-found.png"
            alt="No papers found"
            width={256}
            height={256}
            className="w-48 sm:w-64 h-auto mb-6"
          />
          <h3 className="text-lg sm:text-xl font-semibold mb-2 text-center">
            No papers found
          </h3>
          <p className="text-content/60 mb-4 text-sm sm:text-base text-center max-w-md">
            {isAnyFilterActive
              ? "No papers match the current filters."
              : `We couldn't find any papers for ${
                  selectedSubject || "this subject"
                }. Please try another subject.`}
          </p>
        </div>
      </div>
    );
  }

  // Render batch download progress overlay
  const renderBatchDownloadProgress = () => {
    if (!batchDownloadProgress) return null;

    const getStatusText = () => {
      switch (batchDownloadProgress.status) {
        case "preparing":
          return "Preparing download...";
        case "downloading":
          return `Downloading ${batchDownloadProgress.completed || 0} of ${
            batchDownloadProgress.totalPapers
          } papers...`;
        case "processing":
          return "Creating ZIP file...";
        case "sending":
          return "Sending to your browser...";
        case "complete":
          return "Download complete!";
        case "error":
          return batchDownloadProgress.error || "Download failed";
        default:
          return "Processing...";
      }
    };

    const getProgressPercentage = () => {
      if (batchDownloadProgress.percentage !== undefined) {
        return batchDownloadProgress.percentage;
      }

      // Fallback percentages
      if (batchDownloadProgress.status === "complete") return 100;
      if (batchDownloadProgress.status === "error") return 0;
      if (batchDownloadProgress.status === "preparing") return 5;
      if (batchDownloadProgress.status === "downloading") return 30;
      if (batchDownloadProgress.status === "processing") return 70;
      if (batchDownloadProgress.status === "sending") return 90;
      return 0;
    };

    const getDetailText = () => {
      if (batchDownloadProgress.currentPaper) {
        return batchDownloadProgress.currentPaper;
      }

      if (batchDownloadProgress.status === "complete") {
        return `Successfully downloaded ${batchDownloadProgress.totalPapers} papers`;
      }
      if (batchDownloadProgress.status === "error") {
        return batchDownloadProgress.error &&
          batchDownloadProgress.error.includes("Failed to connect")
          ? "Check your network connection and try again"
          : "";
      }

      if (batchDownloadProgress.status === "downloading") {
        const percent = getProgressPercentage();
        return `${percent.toFixed(0)}%`;
      }

      if (batchDownloadProgress.status === "processing") {
        return "Compressing files into ZIP archive";
      }

      if (batchDownloadProgress.status === "sending") {
        return "Starting browser download";
      }

      const percentage = getProgressPercentage();
      return `${percentage.toFixed(0)}% complete`;
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-secondary rounded-xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-content">
              {batchDownloadProgress.status === "complete"
                ? "Download Complete"
                : "Downloading Papers"}
            </h3>
            {(batchDownloadProgress.status === "complete" ||
              batchDownloadProgress.status === "error") && (
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
                className={`h-full ${
                  batchDownloadProgress.status === "error"
                    ? "bg-red-500"
                    : "bg-brand"
                } transition-all duration-300`}
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
            <div className="mt-1 flex justify-between text-xs text-content/70">
              <span>{getStatusText()}</span>
              <span>{getDetailText()}</span>
            </div>
          </div>

          {batchDownloadProgress.status === "error" && (
            <div className="mt-4 text-center">
              <p className="text-red-500 mb-4 text-sm">
                {batchDownloadProgress.error}
              </p>
              <button
                onClick={() => {
                  // Directly restart the batch download with the same papers
                  setBatchDownloadProgress({
                    totalPapers: selectedPapersArray.length,
                    completed: 0,
                    status: "preparing",
                    percentage: 0,
                  });

                  // Small delay to show the preparing state before starting
                  setTimeout(() => {
                    batchDownloadPapers(
                      selectedPapersArray,
                      filters,
                      (progress) => {
                        setBatchDownloadProgress(progress);

                        if (
                          progress.status === "complete" ||
                          progress.status === "error"
                        ) {
                          const timeoutDuration =
                            progress.status === "error" ? 3000 : 1000;
                          setTimeout(() => {
                            setBatchDownloadProgress(null);

                            if (progress.status === "complete") {
                              setIsSelectMode(false);
                              setSelectedPapers({});
                            }
                          }, timeoutDuration);
                        }
                      }
                    );
                  }, 300);
                }}
                className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 hover:bg-brand/90 focus:outline-none"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleBatchDownload = async () => {
    if (selectedPapersArray.length === 0) {
      toast.error("No papers selected for download");
      return;
    }

    // For a single paper, download directly instead of batching
    if (selectedPapersArray.length === 1) {
      const paper = selectedPapersArray[0];
      try {
        const toastId = toast.loading(`Downloading ${paper.fileName}...`);

        const success = await downloadFile(paper.url, paper.fileName);

        // Dismiss the loading toast
        toast.dismiss(toastId);

        if (success) {
          setIsSelectMode(false);
          setSelectedPapers({});
        }
      } catch (error) {
        console.error("Download failed:", error);
        toast.error("Failed to download paper. Please try again.");
      }
      return;
    }

    // Reset any previous progress for batch downloads
    setBatchDownloadProgress({
      totalPapers: selectedPapersArray.length,
      completed: 0,
      status: "preparing",
      percentage: 0,
    });

    // Attempt the batch download with filter information
    await batchDownloadPapers(selectedPapersArray, filters, (progress) => {
      setBatchDownloadProgress(progress);

      // If complete or error, clear progress after a delay
      if (progress.status === "complete" || progress.status === "error") {
        const timeoutDuration = progress.status === "error" ? 3000 : 1000;
        setTimeout(() => {
          setBatchDownloadProgress(null);

          // If download was successful, exit select mode
          if (progress.status === "complete") {
            setIsSelectMode(false);
            setSelectedPapers({});
          }
        }, timeoutDuration);
      }
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
      {/* Sticky header with Back button, subject title, and action buttons */}
      <div className="sticky top-0 z-20 bg-primary/80 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-4 rounded-xl flex flex-col mb-6 sm:mb-8 shadow-sm border border-accent/50">
        {/* Top row: Back button, subject title, selection toggle, filter toggle */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-3 sm:gap-4 max-w-[80%] sm:max-w-[60%]">
            <button
              onClick={() => router.push("/papers")}
              className="p-2 sm:p-2.5 rounded-lg bg-secondary text-content/80 transition-colors hover:text-brand"
              aria-label="Back to Subjects"
            >
              <ArrowLeft size={18} weight="bold" />
            </button>
            <h2 className="text-lg sm:text-2xl font-bold text-content truncate">
              {selectedSubject}
            </h2>

            {/* Selected count badge - moved up to the main title area for better visibility */}
            {isSelectMode && selectedPapersCount > 0 && (
              <span className="ml-2 text-xs bg-brand text-white font-medium rounded-full px-2.5 py-1 shadow-sm">
                {selectedPapersCount}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 relative">
            <button
              onClick={toggleSelectMode}
              className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
                isSelectMode
                  ? "bg-brand text-white"
                  : "bg-secondary text-content/80 hover:text-brand"
              }`}
              aria-label={
                isSelectMode ? "Exit selection mode" : "Enter selection mode"
              }
            >
              {isSelectMode ? (
                <X size={16} weight="bold" />
              ) : (
                <CheckSquare size={16} weight="bold" />
              )}
            </button>
            {showSelectTuto && (
              <FadeIn
                duration={0.3}
                className="absolute top-full right-7 mt-2 w-60 z-50"
              >
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-brand/20 relative">
                  {/* Pointer arrow */}
                  <div className="absolute -top-2 right-7 w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-t-2 border-brand/20 transform rotate-45"></div>

                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-brand/10 rounded-full flex items-center justify-center">
                      <CheckSquare
                        size={14}
                        weight="bold"
                        className="text-brand"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-content mb-2 leading-relaxed">
                        <span className="text-brand font-semibold">
                          Pro Tip:
                        </span>{" "}
                        Select multiple papers and download them all at once for
                        convenience!
                      </p>
                      <button
                        onClick={handleDismissTuto}
                        className="w-full bg-brand text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-brand/90 transition-colors duration-200 shadow-sm"
                      >
                        Got it!
                      </button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}
            <div className="relative">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
                  isAnyFilterActive || showFilters
                    ? "bg-brand text-white"
                    : "bg-secondary text-content/80 hover:text-brand"
                }`}
                aria-label="Show filters"
              >
                <Funnel
                  size={16}
                  weight={isAnyFilterActive ? "fill" : "bold"}
                />
              </button>
              {renderFilterDropdown()}
            </div>
          </div>
        </div>

        {/* Bottom row: Paper count, selection controls, view toggle, and on mobile - action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isSelectMode ? (
              <button
                onClick={toggleAllPapers}
                className="text-sm text-content/80 hover:text-brand flex items-center gap-1.5 py-1"
              >
                {selectedPapersCount === filteredPapers.length &&
                filteredPapers.length > 0 ? (
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
              <span className="text-xs sm:text-sm text-content/80">
                {filteredPapers.length} papers
              </span>
            )}
          </div>

          {/* Mobile only action buttons in second row */}
          <div className="flex sm:hidden items-center gap-2 relative">
            <button
              onClick={toggleSelectMode}
              className={`p-2 rounded-lg transition-colors ${
                isSelectMode
                  ? "bg-brand text-white"
                  : "bg-secondary text-content/80 hover:text-brand"
              }`}
              aria-label={
                isSelectMode ? "Exit selection mode" : "Enter selection mode"
              }
            >
              {isSelectMode ? (
                <X size={16} weight="bold" />
              ) : (
                <CheckSquare size={16} weight="bold" />
              )}
            </button>
            {showSelectTuto && (
              <FadeIn
                duration={0.3}
                className="absolute top-full right-12 mt-2 w-60 z-50"
              >
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-brand/20 relative">
                  {/* Pointer arrow */}
                  <div className="absolute -top-2 right-10 w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-t-2 border-brand/20 transform rotate-45"></div>

                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-brand/10 rounded-full flex items-center justify-center">
                      <CheckSquare
                        size={14}
                        weight="bold"
                        className="text-brand"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-content mb-2 leading-relaxed">
                        <span className="text-brand font-semibold">
                          Pro Tip:
                        </span>{" "}
                        Select multiple papers and download them all at once for
                        convenience!
                      </p>
                      <button
                        onClick={handleDismissTuto}
                        className="w-full bg-brand text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-brand/90 transition-colors duration-200 shadow-sm"
                      >
                        Got it!
                      </button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}
            <div className="relative">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`p-2 rounded-lg transition-colors ${
                  isAnyFilterActive || showFilters
                    ? "bg-brand text-white"
                    : "bg-secondary text-content/80 hover:text-brand"
                }`}
                aria-label="Show filters"
              >
                <Funnel
                  size={16}
                  weight={isAnyFilterActive ? "fill" : "bold"}
                />
              </button>
              {renderFilterDropdown()}
            </div>

            <button
              onClick={toggleViewMode}
              className="p-2 rounded-lg bg-secondary text-content/80 transition-colors hover:text-brand"
              aria-label="Toggle view mode"
            >
              {viewMode === "grid" ? (
                <List size={16} weight="bold" />
              ) : (
                <GridFour size={16} weight="bold" />
              )}
            </button>
          </div>

          {/* View toggle slider for desktop */}
          <div className="hidden md:flex items-center p-1 bg-secondary rounded-lg space-x-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-brand text-white"
                  : "text-content/80 hover:text-brand"
              }`}
              aria-label="Grid view"
            >
              <GridFour
                size={18}
                weight={viewMode === "grid" ? "fill" : "regular"}
              />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-brand text-white"
                  : "text-content/80 hover:text-brand"
              }`}
              aria-label="List view"
            >
              <List
                size={18}
                weight={viewMode === "list" ? "fill" : "regular"}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Display papers */}
      <FadeIn>
        {viewMode === "grid" ? renderGridView() : renderListView()}
      </FadeIn>

      {/* Batch download floating button */}
      {isSelectMode && selectedPapersCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <button
            onClick={handleBatchDownload}
            className="bg-brand text-white px-4 py-3 sm:px-6 sm:py-3.5 rounded-xl shadow-xl backdrop-blur-sm transition-colors duration-200 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50 flex items-center gap-2 border border-brand/30"
          >
            {selectedPapersCount === 1 ? (
              <Download size={20} weight="duotone" />
            ) : (
              <FileZip size={20} weight="duotone" />
            )}
            <span>
              Download {selectedPapersCount}{" "}
              {selectedPapersCount === 1 ? "Paper" : "Papers"}
            </span>
          </button>
        </div>
      )}

      {/* Batch download progress overlay */}
      {batchDownloadProgress && renderBatchDownloadProgress()}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPDFOpen}
        onClose={closePreview}
        paper={currentPaper}
        papers={pdfPapers}
        onNavigate={navigateToPaper}
      />
    </div>
  );
};

export default SubjectPapersView;
