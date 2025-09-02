"use client";

import { useEffect, useRef } from "react";
import { Paper } from "@/types/paper";
import { downloadFile } from "@/utils/download";

import { usePDFDocument } from "./hooks/usePDFDocument";
import { usePDFZoom } from "./hooks/usePDFZoom";
import { usePDFNavigation } from "./hooks/usePDFNavigation";
import { usePDFGestures } from "./hooks/usePDFGestures";
import { usePDFRenderer } from "./hooks/usePDFRenderer";

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
}

export default function PDFPreviewModal({
  isOpen,
  onClose,
  paper,
  papers,
  onNavigate,
}: PDFPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { pdfDoc, numPages, loading, error } = usePDFDocument(paper, isOpen);

  const {
    scale,
    internalScale,
    currentScale,
    hasAutoZoomed,
    setScale,
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
    goToPrevPage,
    goToNextPage,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
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
    setRenderedPages,
    resetRenderer,
  } = usePDFRenderer(pdfDoc, scale, internalScale);

  // Auto-zoom effect
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
        const newScale = Math.min(internalScale * 1.2, 5.0);
        updateZoomScale(newScale);
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
    internalScale,
    updateZoomScale,
    setHasAutoZoomed,
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

        if (newVisiblePages.size > 0) {
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
  }, [numPages, renderPage, setVisiblePages, setPageNumber, pageContainerRefs]);

  // Scale change handler
  useEffect(() => {
    const currentScaleValue = internalScale || scale || 1.0;
    if (
      visiblePages.size > 0 &&
      Math.abs(currentScale - currentScaleValue) > 0.01
    ) {
      setCurrentScale(currentScaleValue);

      requestAnimationFrame(() => {
        const isMobile = window.innerWidth <= 768;
        const maxPages = isMobile ? 2 : 3;
        const pagesToRender = Array.from(visiblePages).slice(0, maxPages);

        pagesToRender.forEach((pageNum) => {
          renderPage(pageNum);
        });
      });
    }
  }, [
    internalScale,
    scale,
    visiblePages,
    renderPage,
    currentScale,
    setCurrentScale,
  ]);

  // Wheel event for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

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
    if (paper) {
      await downloadFile(paper.url, paper.fileName);
    }
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
    goToPrevPage,
    goToNextPage,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
    handleZoomIn,
    handleZoomOut,
    handleZoomActual,
    handleZoomFit: () => handleZoomFit(containerRef, pdfDoc, pageNumber),
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
  };

  if (!isOpen || !paper) return null;

  return (
    <PDFProvider value={contextValue}>
      <div className="fixed inset-0 z-50 bg-slate-50" data-pdf-modal>
        <PDFToolbar />

        {/* Main content area */}
        <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50">
          {/* PDF Viewer */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-50"
            onMouseDown={contextValue.handleMouseDown}
            onMouseMove={contextValue.handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={contextValue.handleTouchStart}
            onTouchMove={contextValue.handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              scrollBehavior: "auto",
              willChange: "scroll-position",
              transform: "translate3d(0, 0, 0)",
              backfaceVisibility: "hidden",
              contain: "layout style paint",
            }}
          >
            <div
              className="w-full min-h-full"
              style={{
                padding: "20px",
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
                }}
              >
                {loading && <PDFLoadingState />}

                {error && <PDFErrorState error={error} />}

                {/* Render all pages */}
                {!loading && !error && numPages > 0 && (
                  <div className="space-y-6">
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
