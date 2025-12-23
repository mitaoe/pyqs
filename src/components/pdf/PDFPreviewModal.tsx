"use client";

import { useEffect, useRef, useState } from "react";
import { Paper } from "@/types/paper";
import { downloadFile } from "@/utils/download";
import { useServerStatus } from "@/contexts/ServerStatusContext";

import { usePDFDocument } from "./hooks/usePDFDocument";
import { usePDFZoom } from "./hooks/usePDFZoom";
import { usePDFNavigation } from "./hooks/usePDFNavigation";
import { usePDFGestures } from "./hooks/usePDFGestures";
import { usePDFRenderer } from "./hooks/usePDFRenderer";
import { useResponsive } from "./hooks/useResponsive";

import { PDFProvider } from "./context/PDFContext";
import { PDFToolbar } from "./components/PDFToolbar";
import { PDFLoadingState } from "./components/PDFLoadingState";
import { PDFErrorState } from "./components/PDFErrorState";
import { PDFPage } from "./components/PDFPage";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
  papers: Paper[];
  onNavigate: (paper: Paper) => void;
  onFailure?: () => void;
}

export default function PDFPreviewModal({
  isOpen,
  onClose,
  paper,
  papers,
  onNavigate,
  onFailure,
}: PDFPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Custom hooks
  const { isMobile } = useResponsive();
  const { isServerDown } = useServerStatus();
  const { pdfDoc, numPages, loading, error } = usePDFDocument(paper, isOpen, onFailure);

  // Auto-close modal only if server is down, otherwise let user retry with reload button
  useEffect(() => {
    if (error && !loading && isServerDown) {
      // Small delay so user sees the error briefly before closing
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error, loading, isServerDown, onClose]);

  const {
    scale,
    internalScale,
    currentScale,
    hasAutoZoomed,
    setCurrentScale,
    setHasAutoZoomed,
    updateZoomScale,
    handleZoomIn,
    handleZoomOut,
    handleZoomActual,
    handleZoomFit,
    currentScaleRef,
    lastPinchDistance,
    zoomCenter,
  } = usePDFZoom(1.0);

  const {
    pageNumber,
    setPageNumber,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
    goToPrevPage: goToPrevPageHook,
    goToNextPage: goToNextPageHook,
  } = usePDFNavigation(papers, paper, onNavigate);

  const {
    isDragging,
    tool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePDFGestures(
    updateZoomScale,
    currentScaleRef,
    lastPinchDistance,
    zoomCenter
  );

  const {
    renderedPages,
    visiblePages,
    setVisiblePages,
    pageRefs,
    pageContainerRefs,
    renderPage,
    cancelAllRenders,
    resetRenderer,
  } = usePDFRenderer(pdfDoc, scale, internalScale);

  // Auto-zoom effect (fit to width on mobile, negligible zoom on desktop)
  useEffect(() => {
    if (
      !loading &&
      !error &&
      pdfDoc &&
      numPages > 0 &&
      renderedPages.size > 0 &&
      !hasAutoZoomed
    ) {
      const autoZoomTimer = setTimeout(() => {
        if (isMobile) {
          // On mobile, fit to width for better initial view
          handleZoomFit(containerRef, pdfDoc, pageNumber);
        } else {
          // On desktop, apply a negligible zoom (1% increase) just to trigger the system
          const newScale = Math.min(internalScale * 1.01, 5.0);
          updateZoomScale(newScale);
        }
        setHasAutoZoomed(true);
      }, 500);

      return () => clearTimeout(autoZoomTimer);
    }
  }, [
    loading,
    error,
    pdfDoc,
    numPages,
    renderedPages.size,
    hasAutoZoomed,
    isMobile,
    internalScale,
    updateZoomScale,
    setHasAutoZoomed,
    handleZoomFit,
    pageNumber,
  ]);

  // Reset auto-zoom when paper changes
  useEffect(() => {
    if (paper) {
      setHasAutoZoomed(false);
    }
  }, [paper, setHasAutoZoomed]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const newVisiblePages = new Set<number>();

        entries.forEach((entry) => {
          const pageNum = parseInt(
            entry.target.getAttribute("data-page") || "0"
          );

          if (entry.isIntersecting) {
            newVisiblePages.add(pageNum);
            renderPage(pageNum);
          }
        });

        setVisiblePages(newVisiblePages);

        // Only update page number if we're not currently navigating programmatically
        if (newVisiblePages.size > 0 && !isNavigating) {
          const firstVisible = Math.min(...Array.from(newVisiblePages));
          setPageNumber(firstVisible);
        }
      },
      {
        root: containerRef.current,
        rootMargin: "200px 0px",
        threshold: 0.1,
      }
    );

    pageContainerRefs.current.forEach((container) => {
      if (container) observer.observe(container);
    });

    return () => observer.disconnect();
  }, [numPages, renderPage, setVisiblePages, setPageNumber, pageContainerRefs, isNavigating]);

  // Scale change handler with debouncing
  useEffect(() => {
    const currentScaleValue = internalScale || scale || 1.0;
    if (
      visiblePages.size > 0 &&
      Math.abs(currentScale - currentScaleValue) > 0.01
    ) {
      setCurrentScale(currentScaleValue);

      // Debounce the rendering to prevent excessive re-renders during zoom
      const renderTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          const isMobile = window.innerWidth <= 768;
          const maxPages = isMobile ? 3 : 5; // Render more pages for better experience
          const pagesToRender = Array.from(visiblePages).slice(0, maxPages);

          // Prioritize currently visible pages
          const sortedPages = pagesToRender.sort((a, b) => {
            const aDistance = Math.abs(a - pageNumber);
            const bDistance = Math.abs(b - pageNumber);
            return aDistance - bDistance;
          });

          sortedPages.forEach((pageNum, index) => {
            // Stagger rendering slightly to prevent blocking
            setTimeout(() => renderPage(pageNum, true), index * 10);
          });
        });
      }, 50); // Small delay to debounce rapid zoom changes

      return () => clearTimeout(renderTimeout);
    }
  }, [
    internalScale,
    scale,
    visiblePages,
    renderPage,
    currentScale,
    setCurrentScale,
    pageNumber,
  ]);

  // Wheel event for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Use 10% increments for consistent zoom behavior
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = internalScale + delta;

        const rect = container.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;

        updateZoomScale(newScale, centerX, centerY);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [internalScale, updateZoomScale]);

  // Initial render of first few pages
  useEffect(() => {
    if (pdfDoc && numPages > 0 && renderedPages.size === 0) {
      const initialPages = Math.min(3, numPages);

      for (let i = 1; i <= initialPages; i++) {
        setTimeout(() => renderPage(i), i * 100);
      }
    }
  }, [pdfDoc, numPages, renderedPages, renderPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
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
  }, [isOpen, handleZoomIn, handleZoomOut, handleZoomActual, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllRenders();
    };
  }, [cancelAllRenders]);

  // Reset state when new document loads
  useEffect(() => {
    if (pdfDoc) {
      resetRenderer();
      setCurrentScale(scale);
    }
  }, [pdfDoc, resetRenderer, setCurrentScale, scale]);

  const handleDownload = async () => {
    if (!paper || !pdfDoc) return;

    try {
      // Get the PDF data from the loaded document
      const pdfBytes = await pdfDoc.getData();

      // Create a blob from the PDF data
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = paper.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to original download method if PDF data extraction fails
      await downloadFile(paper.url, paper.fileName);
    }
  };

  // Wrapper functions for page navigation
  const goToPrevPage = () => {
    goToPrevPageHook(numPages, pageContainerRefs, containerRef);
  };

  const goToNextPage = () => {
    goToNextPageHook(numPages, pageContainerRefs, containerRef);
  };

  const contextValue = {
    pdfDoc,
    numPages,
    loading,
    error,
    pageNumber,
    setPageNumber,
    scale,
    internalScale,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
    goToPrevPage,
    goToNextPage,
    handleZoomIn,
    handleZoomOut,
    handleZoomActual,
    handleZoomFit: () => handleZoomFit(containerRef, pdfDoc, pageNumber),
    updateZoomScale,
    isDragging,
    tool,
    handleMouseDown: (e: React.MouseEvent) => handleMouseDown(e, containerRef),
    handleMouseMove: (e: React.MouseEvent) => handleMouseMove(e, containerRef),
    handleMouseUp,
    handleTouchStart: (e: React.TouchEvent) =>
      handleTouchStart(e, containerRef),
    handleTouchMove: (e: React.TouchEvent) => handleTouchMove(e, containerRef),
    handleTouchEnd,
    paper,
    papers,
    onClose,
    handleDownload,
    containerRef,
    isNavigating,
    setIsNavigating,
  };

  // Add viewport meta tag to prevent zooming and disable background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store original viewport meta tag
      const originalViewport = document.querySelector('meta[name="viewport"]');
      const originalContent = originalViewport?.getAttribute('content') || '';

      // Store original body styles
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      // Set new viewport to prevent zooming
      if (originalViewport) {
        originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      // Disable background scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      // Restore original styles when modal closes
      return () => {
        // Always restore body styles regardless of viewport meta tag branch
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
        
        // Restore viewport meta tag if it was modified
        if (originalViewport && originalContent) {
          originalViewport.setAttribute('content', originalContent);
        }
      };
    }
  }, [isOpen]);

  if (!isOpen || !paper) return null;

  return (
    <PDFProvider value={contextValue}>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: '#333333' }} data-pdf-modal>
        <PDFToolbar />

        {/* Main content area */}
        <div className="flex h-[calc(100vh-3rem)]" style={{ backgroundColor: '#333333' }}>
          {/* PDF Viewer */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto"
            style={{
              backgroundColor: '#333333',
              touchAction: 'none', // Prevent browser zoom and scrolling
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
            onMouseDown={contextValue.handleMouseDown}
            onMouseMove={contextValue.handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={contextValue.handleTouchStart}
            onTouchMove={contextValue.handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="w-full min-h-full"
              style={{
                padding: isMobile ? "10px" : "20px",
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
                    tool === "hand"
                      ? isDragging
                        ? "grabbing"
                        : "grab"
                      : "text",
                  minWidth: "fit-content",
                  width: isMobile && (internalScale || scale) <= 1.0 ? "100%" : "auto",
                  touchAction: 'none', // Prevent browser zoom on PDF content
                }}
              >
                {loading && <PDFLoadingState />}

                {error && <PDFErrorState error={error} />}

                {/* Render all pages */}
                {!loading && !error && numPages > 0 && (
                  <div
                    className={isMobile ? "space-y-2" : "space-y-6"}
                    style={{
                      width: isMobile && (internalScale || scale) <= 1.0 ? "100%" : "auto",
                    }}
                  >
                    {Array.from({ length: numPages }, (_, index) => {
                      const pageNum = index + 1;
                      return (
                        <PDFPage
                          key={pageNum}
                          pageNum={pageNum}
                          pageContainerRefs={pageContainerRefs}
                          pageRefs={pageRefs}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PDFProvider>
  );
}