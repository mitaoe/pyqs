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
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const [currentScale, setCurrentScale] = useState<number>(1.0);
  const [internalScale, setInternalScale] = useState<number>(scale || 1.0);
  const [hasAutoZoomed, setHasAutoZoomed] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, any>>(new Map());
  const renderingPages = useRef<Set<number>>(new Set());
  const pageScales = useRef<Map<number, number>>(new Map());
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isScrolling = useRef<boolean>(false);

  // Native zoom control refs and state
  const zoomTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastPinchDistance = useRef<number>(0);
  const isZooming = useRef<boolean>(false);
  const zoomCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentScaleRef = useRef<number>(scale || 1.0);

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

  // Sync internal scale with external scale prop
  useEffect(() => {
    if (scale && Math.abs(scale - internalScale) > 0.01) {
      setInternalScale(scale);
    }
  }, [scale, internalScale]);

  // Keep currentScaleRef updated with the latest scale value
  useEffect(() => {
    const latestScale = internalScale || scale || currentScale || 1.0;
    currentScaleRef.current = latestScale;
  }, [internalScale, scale, currentScale]);

  // Initialize scale state when component mounts
  useEffect(() => {
    if (!scale && currentScale) {
      setScale(currentScale);
      setInternalScale(currentScale);
    }
  }, [scale, currentScale, setScale]);

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

  // Calculate distance between two touch points (React.TouchList compatible)
  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;

    const touch1 = touches[0];
    const touch2 = touches[1];

    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches (React.TouchList compatible)
  const getTouchCenter = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };

    const touch1 = touches[0];
    const touch2 = touches[1];

    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  // Native zoom control functions
  const updateZoomScale = useCallback(
    (newScale: number, centerX?: number, centerY?: number) => {
      // Clamp scale to reasonable bounds
      const clampedScale = Math.max(0.25, Math.min(5.0, newScale));

      if (Math.abs(clampedScale - internalScale) > 0.01) {
        // Use small threshold for comparison
        // Store zoom center for potential scroll adjustment
        if (centerX !== undefined && centerY !== undefined) {
          zoomCenter.current = { x: centerX, y: centerY };
        }

        // Update scale states immediately for responsive UI
        setInternalScale(clampedScale);
        setScale(clampedScale);
        // Update ref immediately for pinch zoom
        currentScaleRef.current = clampedScale;

        // Cancel ongoing renders and throttle re-rendering for performance
        if (zoomTimeout.current) {
          clearTimeout(zoomTimeout.current);
        }

        // Cancel renders only when zoom gesture is active
        if (isZooming.current) {
          renderTasks.current.forEach((task) => {
            task.cancel();
          });
          renderTasks.current.clear();
          renderingPages.current.clear();
        }

        zoomTimeout.current = setTimeout(() => {
          isZooming.current = false;
        }, 100); // Reduced timeout for faster response

        isZooming.current = true;
      }
    },
    [internalScale, setScale]
  );
  useEffect(() => {
    // Auto-increment scale once after initial rendering is complete
    if (
      !loading &&
      !error &&
      pdfDoc &&
      numPages > 0 &&
      renderedPages.size > 0 &&
      !hasAutoZoomed
    ) {
      // Wait a bit to ensure rendering is stable
      const autoZoomTimer = setTimeout(() => {
        const newScale = Math.min(internalScale * 1.2, 5.0); // Increment by 20%
        updateZoomScale(newScale);
        setHasAutoZoomed(true); // Prevent multiple auto-zooms
      }, 500); // 500ms delay to ensure rendering is complete

      return () => clearTimeout(autoZoomTimer);
    }
  }, [
    loading,
    error,
    pdfDoc,
    numPages,
    renderedPages.size,
    hasAutoZoomed,
    internalScale,
    updateZoomScale,
  ]);

  useEffect(() => {
    if (paper) {
      setHasAutoZoomed(false);
    }
  }, [paper]);

  // Zoom functions - updated to use native zoom system
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(internalScale * 1.2, 5.0); // Max 500% (matching native zoom bounds)
    updateZoomScale(newScale);
  }, [internalScale, updateZoomScale]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(internalScale / 1.2, 0.25); // Min 25% (matching native zoom bounds)
    updateZoomScale(newScale);
  }, [internalScale, updateZoomScale]);

  const handleZoomActual = useCallback(() => {
    updateZoomScale(1.0);
  }, [updateZoomScale]);

  const handleZoomFit = useCallback(() => {
    if (containerRef.current && pdfDoc) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 80; // padding + margins
      const containerHeight = container.clientHeight - 80;

      // Get the original page dimensions at scale 1.0
      pdfDoc.getPage(pageNumber).then((page: any) => {
        const viewport = page.getViewport({ scale: 1.0 });
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        const newScale = Math.min(scaleX, scaleY, 5.0); // Updated max to match native zoom bounds
        updateZoomScale(Math.round(newScale * 100) / 100);
      });
    }
  }, [pdfDoc, pageNumber, updateZoomScale]);

  // Enhanced touch event handlers with pinch zoom support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Two finger pinch zoom
        const distance = getTouchDistance(e.touches);
        lastPinchDistance.current = distance;
        isZooming.current = true;

        // Get pinch center
        const center = getTouchCenter(e.touches);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          zoomCenter.current = {
            x: center.x - rect.left,
            y: center.y - rect.top,
          };
        }

        e.preventDefault(); // Prevent default pinch behavior
      } else if (
        tool === "hand" &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Single finger drag (only if not zooming)
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX, y: touch.clientY });
        if (containerRef.current) {
          setScrollStart({
            x: containerRef.current.scrollLeft,
            y: containerRef.current.scrollTop,
          });
        }
      }
    },
    [tool, getTouchDistance, getTouchCenter]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && isZooming.current) {
        // Handle pinch zoom
        const currentDistance = getTouchDistance(e.touches);

        if (lastPinchDistance.current > 0) {
          const scaleChange = currentDistance / lastPinchDistance.current;
          // Use ref to get the most current scale value (avoids stale closure)
          const newScale = currentScaleRef.current * scaleChange;

          // Get current pinch center
          const center = getTouchCenter(e.touches);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = center.x - rect.left;
            const centerY = center.y - rect.top;
            updateZoomScale(newScale, centerX, centerY);
          } else {
            updateZoomScale(newScale);
          }
        }

        lastPinchDistance.current = currentDistance;
        e.preventDefault(); // Prevent default pinch behavior
      } else if (
        isDragging &&
        tool === "hand" &&
        containerRef.current &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Handle single finger drag (only if not zooming)
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStart.x;
        const deltaY = touch.clientY - dragStart.y;

        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = scrollStart.x - deltaX;
            containerRef.current.scrollTop = scrollStart.y - deltaY;
          }
        });
      }
    },
    [
      isDragging,
      tool,
      dragStart,
      scrollStart,
      getTouchDistance,
      getTouchCenter,
      updateZoomScale,
    ]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 0) {
        // All fingers lifted - reset zoom state
        isZooming.current = false;
        lastPinchDistance.current = 0;
      }

      if (tool === "hand") {
        setIsDragging(false);
      }
    },
    [tool]
  );

  // Cancel rendering for a specific page
  const cancelPageRender = useCallback((pageNum: number) => {
    const renderTask = renderTasks.current.get(pageNum);
    if (renderTask) {
      renderTask.cancel();
      renderTasks.current.delete(pageNum);
    }
    renderingPages.current.delete(pageNum);
  }, []);

  // Cancel all ongoing renders
  const cancelAllRenders = useCallback(() => {
    renderTasks.current.forEach((task, pageNum) => {
      task.cancel();
    });
    renderTasks.current.clear();
    renderingPages.current.clear();
  }, []);

  // Render a specific PDF page
  const renderPage = useCallback(
    async (pageNum: number, forceRender: boolean = false) => {
      if (!pdfDoc) return;

      const canvas = pageRefs.current.get(pageNum);
      if (!canvas) return;

      // Get current scale value (prioritize internalScale for immediate response)
      const currentScaleValue = internalScale || scale || 1.0;

      // Always re-render if scale has changed to prevent zoom reversion
      const lastRenderedScale = pageScales.current.get(pageNum);
      if (
        !forceRender &&
        lastRenderedScale === currentScaleValue &&
        renderedPages.has(pageNum)
      ) {
        return; // Already rendered at current scale
      }

      // Cancel any existing render for this page to prevent canvas conflicts
      cancelPageRender(pageNum);

      // Double-check if already rendering this page (race condition protection)
      if (renderingPages.current.has(pageNum)) {
        console.warn(`Page ${pageNum} is already being rendered, skipping...`);
        return;
      }

      // Mark as rendering
      renderingPages.current.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const context = canvas.getContext("2d");

        if (!context) {
          renderingPages.current.delete(pageNum);
          return;
        }

        // Use current scale value in viewport for proper canvas sizing
        const viewport = page.getViewport({ scale: currentScaleValue });

        // Optimize canvas size for mobile performance
        const scaledWidth = viewport.width;
        const scaledHeight = viewport.height;

        // Set canvas size with optimized scaling for mobile
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = scaledWidth + "px";
        canvas.style.height = scaledHeight + "px";

        // Reset any previous transforms
        context.setTransform(1, 0, 0, 1, 0, 0);

        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Start render and store the task
        const renderTask = page.render(renderContext);
        renderTasks.current.set(pageNum, renderTask);

        await renderTask.promise;

        // Clean up and mark as rendered
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);
        pageScales.current.set(pageNum, currentScaleValue); // Track the scale this page was rendered at
        setRenderedPages((prev) => new Set([...prev, pageNum]));
      } catch (err) {
        // Clean up on error
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);

        const errorMessage = (err as any)?.message || "";
        const errorName = (err as any)?.name || "";

        if (errorName !== "RenderingCancelledException") {
          // Handle canvas conflicts specifically
          if (
            errorMessage.includes("canvas") &&
            errorMessage.includes("render")
          ) {
            console.warn(`Canvas conflict for page ${pageNum}, will retry...`);
            // Retry immediately with requestAnimationFrame for better mobile performance
            requestAnimationFrame(() => {
              renderPage(pageNum, true);
            });
          } else {
            console.error(`Error rendering page ${pageNum}:`, err);
            setError(`Failed to render PDF page ${pageNum}`);
          }
        }
      }
    },
    [pdfDoc, internalScale, scale, cancelPageRender, renderedPages]
  );

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Simplified intersection observer for reliable page loading
        const newVisiblePages = new Set<number>();

        entries.forEach((entry) => {
          const pageNum = parseInt(
            entry.target.getAttribute("data-page") || "0"
          );

          if (entry.isIntersecting) {
            newVisiblePages.add(pageNum);
            // Render page when it becomes visible
            renderPage(pageNum);
          }
        });

        // Update state
        setVisiblePages(newVisiblePages);

        // Update current page number based on first visible page
        if (newVisiblePages.size > 0) {
          const firstVisible = Math.min(...Array.from(newVisiblePages));
          setPageNumber(firstVisible);
        }
      },
      {
        root: containerRef.current,
        rootMargin: "200px 0px", // Preload pages before they're visible
        threshold: 0.1,
      }
    );

    // Observe all page containers
    pageContainerRefs.current.forEach((container) => {
      if (container) observer.observe(container);
    });

    return () => observer.disconnect();
  }, [numPages, renderPage, renderedPages]);

  // Optimized scale change handler for mobile performance
  useEffect(() => {
    const currentScaleValue = internalScale || scale || 1.0;
    if (
      visiblePages.size > 0 &&
      Math.abs(currentScale - currentScaleValue) > 0.01
    ) {
      setCurrentScale(currentScaleValue);

      // Use requestAnimationFrame for smoother rendering on mobile
      requestAnimationFrame(() => {
        // Optimize for mobile: render fewer pages during zoom
        const isMobile = window.innerWidth <= 768;
        const maxPages = isMobile ? 2 : 3; // Render fewer pages on mobile
        const pagesToRender = Array.from(visiblePages).slice(0, maxPages);

        pagesToRender.forEach((pageNum) => {
          renderPage(pageNum);
        });
      });
    }
  }, [internalScale, scale, visiblePages, renderPage, currentScale]);

  // Add wheel event listener for native zoom control
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Calculate zoom delta
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = internalScale + delta;

        // Get mouse position relative to container for zoom center
        const rect = container.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;

        updateZoomScale(newScale, centerX, centerY);
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [internalScale, updateZoomScale]);

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

        // Cancel any ongoing renders
        cancelAllRenders();

        // Reset state for new document
        setRenderedPages(new Set());
        setVisiblePages(new Set());
        setCurrentScale(scale);

        // Clear existing refs
        pageRefs.current.clear();
        pageContainerRefs.current.clear();
        pageScales.current.clear();
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    loadPDF();

    // Cleanup on unmount
    return () => {
      cancelAllRenders();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (zoomTimeout.current) clearTimeout(zoomTimeout.current);
    };
  }, [isOpen, paper, cancelAllRenders]);

  // Initial render of first few pages when PDF loads
  useEffect(() => {
    if (pdfDoc && numPages > 0 && renderedPages.size === 0) {
      // Render first 3 pages initially for better UX
      const initialPages = Math.min(3, numPages);

      for (let i = 1; i <= initialPages; i++) {
        setTimeout(() => renderPage(i), i * 100); // Stagger rendering
      }
    }
  }, [pdfDoc, numPages, renderedPages, renderPage]);

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
    const targetPage = Math.max(pageNumber - 1, 1);
    scrollToPage(targetPage);
  };

  const goToNextPage = () => {
    const targetPage = Math.min(pageNumber + 1, numPages);
    scrollToPage(targetPage);
  };

  const scrollToPage = (pageNum: number) => {
    const pageContainer = pageContainerRefs.current.get(pageNum);
    if (pageContainer && containerRef.current) {
      pageContainer.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
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
      <div className="flex h-10 sm:h-8 bg-gray-700 text-white text-xs overflow-x-auto whitespace-nowrap">
        {/* Left section */}
        <div className="flex items-center flex-shrink-0">
          

          <div className="w-px h-4 bg-gray-500 mx-1 hidden sm:block" />

          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 disabled:opacity-50 flex items-center"
            title="Previous Page"
          >
            <CaretLeft size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 disabled:opacity-50 flex items-center"
            title="Next Page"
          >
            <CaretRight size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <div className="flex items-center px-1 sm:px-2 whitespace-nowrap">
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
                }
              }}
              className="w-6 sm:w-8 bg-transparent text-center border-none outline-none text-xs"
              min={1}
              max={numPages}
            />
            <span className="mx-1 text-xs">of {numPages}</span>
          </div>
        </div>

        {/* Center section */}
        <div className="flex items-center flex-1 justify-center min-w-0">
          <button
            onClick={handleZoomOut}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center"
            title="Zoom Out"
          >
            <MagnifyingGlassMinus size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            onClick={handleZoomIn}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center"
            title="Zoom In"
          >
            <MagnifyingGlassPlus size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <div className="relative">
            <select
              value={Math.round(scale * 100)}
              onChange={(e) => {
                const newScale = Math.min(parseInt(e.target.value) / 100, 3.0);
                setScale(newScale);
              }}
              className="bg-transparent border-none outline-none px-1 hover:bg-gray-500 appearance-none text-xs w-12 sm:w-auto"
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

          <div className="w-px h-4 bg-gray-500 mx-1 hidden sm:block" />

          <button
            onClick={handleZoomFit}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 text-xs hidden sm:flex items-center"
            title="Fit to Page"
          >
            <span className="hidden md:inline">Fit</span>
            <ArrowsIn size={16} className="md:hidden sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            onClick={handleZoomActual}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 text-xs hidden sm:flex items-center"
            title="Actual Size"
          >
            <span className="hidden md:inline">Actual</span>
            <ArrowsOut size={16} className="md:hidden sm:w-3.5 sm:h-3.5" />
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center flex-shrink-0">
          {/* PDF Navigation - only show if there are multiple papers */}
          {papers.length > 1 && (
            <>
              <button
                onClick={goToPrevPaper}
                disabled={!canGoPrevPaper()}
                className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Previous PDF"
              >
                <CaretLeft size={16} className="sm:w-3.5 sm:h-3.5" />
              </button>

              <button
                onClick={goToNextPaper}
                disabled={!canGoNextPaper()}
                className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Next PDF"
              >
                <CaretRight size={16} className="sm:w-3.5 sm:h-3.5" />
              </button>

              <div className="w-px h-4 bg-gray-500 mx-1 hidden sm:block" />
            </>
          )}

          <button
            onClick={handleDownload}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center"
            title="Download"
          >
            <Download size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            onClick={() => window.print()}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 hidden sm:flex items-center"
            title="Print"
          >
            <Printer size={16} className="sm:w-3.5 sm:h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-500 mx-1" />

          <button
            onClick={onClose}
            className="px-1 sm:px-2 h-full hover:bg-gray-500 flex items-center"
            title="Close"
          >
            <X size={16} className="sm:w-3.5 sm:h-3.5" />
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y", // Only allow vertical scrolling for better performance
            scrollBehavior: "auto", // Remove smooth scrolling for better mobile performance
            willChange: "scroll-position",
            transform: "translate3d(0, 0, 0)", // Force hardware acceleration
            backfaceVisibility: "hidden",
            contain: "layout style paint", // CSS containment for better performance
          }}
        >
          <div
            className="w-full min-h-full"
            style={{
              padding: "50px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "max-content",
            }}
          >
            <div
              ref={viewerRef}
              className="flex flex-col items-center"
              style={{
                cursor:
                  tool === "hand" ? (isDragging ? "grabbing" : "grab") : "text",
                minWidth: "fit-content",
              }}
            >
              {loading && (
                <div className="flex flex-col items-center justify-center p-12 min-h-[400px] bg-white shadow-lg rounded-lg">
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
                <div className="flex items-center justify-center p-8 bg-white shadow-lg rounded-lg">
                  <div className="text-red-600">{error}</div>
                </div>
              )}

              {/* Render all pages - simplified approach */}
              {!loading && !error && numPages > 0 && (
                <div className="space-y-4">
                  {Array.from({ length: numPages }, (_, index) => {
                    const pageNum = index + 1;

                    return (
                      <div
                        key={pageNum}
                        ref={(el) => {
                          if (el) {
                            pageContainerRefs.current.set(pageNum, el);
                          }
                        }}
                        data-page={pageNum}
                        className="bg-white shadow-lg rounded-lg overflow-hidden"
                        style={{
                          minHeight: "400px", // Placeholder height before rendering
                          minWidth: "fit-content",
                          contain: "layout style paint", // CSS containment for performance
                        }}
                      >
                        <canvas
                          ref={(el) => {
                            if (el) {
                              pageRefs.current.set(pageNum, el);
                            }
                          }}
                          className="block"
                          style={{
                            maxWidth: "none",
                            width: "auto",
                            height: "auto",
                            display: "block",
                            transform: "translate3d(0, 0, 0)",
                            backfaceVisibility: "hidden",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
