"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Download,
  CaretLeft,
  CaretRight,
  ArrowsOut,
  ArrowsIn,
  List,
  Sidebar,
  MagnifyingGlass,
  Printer,
} from "@phosphor-icons/react";
import { Paper } from "@/types/paper";
import { downloadFile } from "@/utils/download";

// PDF.js types
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
  papers: Paper[];
  onNavigate: (paper: Paper) => void;
}

export default function PDFPreviewModal({
  isOpen,
  onClose,
  paper,
  papers,
  onNavigate,
}: PDFPreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState<number>(1.0);
  const tool = "hand"; // Always use hand tool
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [scrollStart, setScrollStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js library
  useEffect(() => {
    if (typeof window !== "undefined" && !window.pdfjsLib) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      };
      document.head.appendChild(script);
    }
  }, []);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.min(prev * 1.2, 3.0); // Max 300%
      return Math.round(newScale * 100) / 100; // Round to 2 decimal places
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev / 1.2, 0.1);
      return Math.round(newScale * 100) / 100; // Round to 2 decimal places
    });
  }, []);

  const handleZoomFit = useCallback(() => {
    if (canvasRef.current && containerRef.current && pdfDoc) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 80; // padding + margins
      const containerHeight = container.clientHeight - 80;

      // Get the original page dimensions at scale 1.0
      pdfDoc.getPage(pageNumber).then((page: any) => {
        const viewport = page.getViewport({ scale: 1.0 });
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        const newScale = Math.min(scaleX, scaleY, 3.0);
        setScale(Math.round(newScale * 100) / 100);
      });
    }
  }, [pdfDoc, pageNumber]);

  const handleZoomActual = useCallback(() => {
    setScale(1.0);
  }, []);

  // Hand tool functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "hand") {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        if (containerRef.current) {
          setScrollStart({
            x: containerRef.current.scrollLeft,
            y: containerRef.current.scrollTop,
          });
        }
        e.preventDefault();
      }
    },
    [tool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && tool === "hand" && containerRef.current) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        containerRef.current.scrollLeft = scrollStart.x - deltaX;
        containerRef.current.scrollTop = scrollStart.y - deltaY;
      }
    },
    [isDragging, tool, dragStart, scrollStart]
  );

  const handleMouseUp = useCallback(() => {
    if (tool === "hand") {
      setIsDragging(false);
    }
  }, [tool]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => {
        const newScale = Math.max(0.1, Math.min(5.0, prev * delta));
        return Math.round(newScale * 100) / 100; // Round to 2 decimal places
      });
    }
  }, []);

  // Render PDF page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) return;

        // Use scale directly in viewport for proper canvas sizing
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Error rendering page:", err);
        setError("Failed to render PDF page");
      }
    },
    [pdfDoc, scale]
  );

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !paper || !window.pdfjsLib) return;

    const loadPDF = async () => {
      setLoading(true);
      setError(null);

      try {
        const pdfUrl = `/api/download/proxy?url=${encodeURIComponent(
          paper.url
        )}`;
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    loadPDF();
  }, [isOpen, paper]);

  // Render page when page number or scale changes
  useEffect(() => {
    if (pdfDoc && pageNumber) {
      renderPage(pageNumber);
    }
  }, [pdfDoc, pageNumber, renderPage]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        container.removeEventListener("wheel", handleWheel);
      };
    }
  }, [handleWheel]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            handleZoomIn();
            break;
          case "-":
            e.preventDefault();
            handleZoomOut();
            break;
          case "0":
            e.preventDefault();
            handleZoomActual();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleZoomIn, handleZoomOut, handleZoomActual]);

  // Navigation functions
  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  // Helper functions to check if navigation is possible
  const canGoPrevPaper = () => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    return currentIndex > 0;
  };

  const canGoNextPaper = () => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    return currentIndex < papers.length - 1;
  };

  const goToPrevPaper = () => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    if (currentIndex > 0) {
      onNavigate(papers[currentIndex - 1]);
    }
  };

  const goToNextPaper = () => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    if (currentIndex < papers.length - 1) {
      onNavigate(papers[currentIndex + 1]);
    }
  };

  const handleDownload = async () => {
    if (paper) {
      await downloadFile(paper.url, paper.fileName);
    }
  };

  if (!isOpen || !paper) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-800" data-pdf-modal>
      {/* PDF.js Toolbar */}
      <div className="flex h-8 bg-gray-700 text-white text-xs">
        {/* Left section */}
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Toggle Sidebar"
          >
            <Sidebar size={14} />
          </button>

          <div className="w-px h-4 bg-gray-500 mx-1" />

          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="px-2 h-full hover:bg-gray-500 disabled:opacity-50 flex items-center"
            title="Previous Page"
          >
            <CaretLeft size={14} />
          </button>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="px-2 h-full hover:bg-gray-500 disabled:opacity-50 flex items-center"
            title="Next Page"
          >
            <CaretRight size={14} />
          </button>

          <div className="flex items-center px-2">
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
                }
              }}
              className="w-8 bg-transparent text-center border-none outline-none"
              min={1}
              max={numPages}
            />
            <span className="mx-1">of {numPages}</span>
          </div>
        </div>

        {/* Center section */}
        <div className="flex items-center flex-1 justify-center">
          <button
            onClick={handleZoomOut}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Zoom Out"
          >
            <MagnifyingGlassMinus size={14} />
          </button>

          <button
            onClick={handleZoomIn}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Zoom In"
          >
            <MagnifyingGlassPlus size={14} />
          </button>

          <div className="relative">
            <select
              value={Math.round(scale * 100)}
              onChange={(e) => {
                const newScale = Math.min(parseInt(e.target.value) / 100, 3.0);
                setScale(newScale);
              }}
              className="bg-transparent border-none outline-none px-1 hover:bg-gray-500 appearance-none"
            >
              <option value={Math.round(scale * 100)}>
                {Math.round(scale * 100)}%
              </option>
              <option value={10}>10%</option>
              <option value={25}>25%</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
              <option value={300}>300%</option>
            </select>
          </div>

          <div className="w-px h-4 bg-gray-500 mx-1" />

          <button
            onClick={handleZoomFit}
            className="px-2 h-full hover:bg-gray-500 text-xs"
            title="Fit to Page"
          >
            Fit
          </button>

          <button
            onClick={handleZoomActual}
            className="px-2 h-full hover:bg-gray-500 text-xs"
            title="Actual Size"
          >
            Actual
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center">
          {/* PDF Navigation - only show if there are multiple papers */}
          {papers.length > 1 && (
            <>
              <button
                onClick={goToPrevPaper}
                disabled={!canGoPrevPaper()}
                className="px-2 h-full hover:bg-gray-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Previous PDF"
              >
                <CaretLeft size={14} />
              </button>

              <button
                onClick={goToNextPaper}
                disabled={!canGoNextPaper()}
                className="px-2 h-full hover:bg-gray-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Next PDF"
              >
                <CaretRight size={14} />
              </button>

              <div className="w-px h-4 bg-gray-500 mx-1" />
            </>
          )}

          <button
            onClick={handleDownload}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Download"
          >
            <Download size={14} />
          </button>

          <button
            onClick={() => window.print()}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Print"
          >
            <Printer size={14} />
          </button>

          <div className="w-px h-4 bg-gray-500 mx-1" />

          <button
            onClick={onClose}
            className="px-2 h-full hover:bg-gray-500 flex items-center"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex h-[calc(100vh-2rem)] bg-gray-800">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 bg-gray-200 border-r border-gray-300 overflow-y-auto">
            <div className="p-2">
              <div className="text-sm font-medium mb-2">Thumbnails</div>
              {/* Thumbnail navigation would go here */}
            </div>
          </div>
        )}

        {/* PDF Viewer */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-800"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="inline-block"
            style={{
              minWidth: "100%",
              minHeight: "100%",
              padding: "50px",
              textAlign: "center",
            }}
          >
            <div
              ref={viewerRef}
              className="bg-white shadow-lg inline-block"
              style={{
                cursor:
                  tool === "hand" ? (isDragging ? "grabbing" : "grab") : "text",
              }}
            >
              {loading && (
                <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                  {/* Animated PDF Icon */}
                  <div className="relative mb-6">
                    <div className="w-16 h-20 bg-white rounded-lg shadow-lg border-2 border-gray-200 flex items-center justify-center relative overflow-hidden">
                      {/* PDF Icon */}
                      <div className="text-red-500 font-bold text-xs">PDF</div>

                      {/* Loading animation overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-50 animate-pulse"></div>

                      {/* Scanning line animation */}
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-pulse"></div>
                    </div>

                    {/* Floating dots around the icon */}
                    <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                    <div
                      className="absolute -bottom-2 -left-2 w-2 h-2 bg-green-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="absolute top-1/2 -right-3 w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>

                  {/* Loading text with typing animation */}
                  <div className="text-gray-300 text-lg font-medium mb-4">
                    <span className="inline-block animate-pulse">
                      Loading PDF
                    </span>
                    <span className="inline-block animate-ping ml-1">.</span>
                    <span
                      className="inline-block animate-ping ml-0.5"
                      style={{ animationDelay: "0.2s" }}
                    >
                      .
                    </span>
                    <span
                      className="inline-block animate-ping ml-0.5"
                      style={{ animationDelay: "0.4s" }}
                    >
                      .
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-64 h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                  </div>

                  {/* Loading message */}
                  <p className="text-gray-400 text-sm mt-4 text-center max-w-xs">
                    Preparing your document for preview...
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center p-8">
                  <div className="text-red-600">{error}</div>
                </div>
              )}

              <canvas
                ref={canvasRef}
                className="block"
                style={{
                  display: loading || error ? "none" : "block",
                  maxWidth: "none",
                  height: "auto",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
