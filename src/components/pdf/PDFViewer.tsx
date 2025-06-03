'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, Download, Plus, Minus } from '@phosphor-icons/react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PDFViewerProps {
  pdfUrl: string;
  fileName: string;
  onClose: () => void;
  onDownload?: () => void;
}

export default function PDFViewer({ pdfUrl, fileName, onClose, onDownload }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfDoc && totalPages > 0) {
      renderAllPages();
    }
  }, [pdfDoc, scale]);

  // Set better initial scale for desktop and detect mobile
  useEffect(() => {
    if (containerRef.current && pdfDoc) {
      const containerWidth = containerRef.current.clientWidth;
      const isDesktop = containerWidth >= 768;
      const mobileDetected = containerWidth < 768;

      setIsMobile(mobileDetected);

      // Set initial scale based on device type
      if (mobileDetected && scale === 1.0) {
        setScale(4.0); // 400% for mobile (high quality)
      } else if (isDesktop && scale === 1.0) {
        setScale(1.3); // 130% for desktop
      }
    }
  }, [pdfDoc]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load PDF using our proxy API
      const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(pdfUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error('Failed to load PDF');
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderAllPages = async () => {
    if (!pdfDoc || !containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);

        // Check if mobile and adjust scale for mobile-first approach
        const containerWidth = containerRef.current.clientWidth;
        const isMobile = containerWidth < 768; // Tailwind's sm breakpoint

        let finalScale = scale;

        if (isMobile) {
          // For mobile: calculate base scale that makes PDF width = container width at 100% zoom
          const originalViewport = page.getViewport({ scale: 1 });
          const mobileBaseScale = (containerWidth - 32) / originalViewport.width; // 16px padding each side

          // Apply user's zoom level relative to this base scale
          // scale 1.0 = perfect fit, scale 1.5 = 150% zoom, scale 0.8 = 80% zoom
          finalScale = mobileBaseScale * scale;
        }

        const viewport = page.getViewport({ scale: finalScale });

        // Create canvas for this page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) continue;

        // Set canvas dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Apply CSS classes - responsive for mobile, natural for desktop
        if (isMobile) {
          canvas.className = 'shadow-lg border border-gray-300 bg-white mb-6 w-full max-w-full h-auto mx-auto block';
        } else {
          canvas.className = 'shadow-lg border border-gray-300 bg-white mb-6 mx-auto block';
        }

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = isMobile
          ? 'flex justify-center px-4'
          : 'flex justify-center px-4';
        pageContainer.appendChild(canvas);

        containerRef.current.appendChild(pageContainer);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setRenderedPages(prev => new Set([...prev, pageNum]));
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.3, 4));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.3, 0.5));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle window resize for mobile orientation changes
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && totalPages > 0 && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const mobileDetected = containerWidth < 768;
        const wasDesktop = !isMobile;

        // Update mobile state
        setIsMobile(mobileDetected);

        // Adjust scale when switching between mobile/desktop
        if (mobileDetected && wasDesktop) {
          // Switching to mobile - set high quality scale
          setScale(4.0);
        } else if (!mobileDetected && !wasDesktop) {
          // Switching to desktop - set reasonable desktop scale
          setScale(1.3);
        }

        // Re-render on mobile for orientation changes
        if (mobileDetected) {
          setTimeout(() => {
            renderAllPages();
          }, 300);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [pdfDoc, totalPages, scale, isMobile]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-secondary/95 backdrop-blur-sm border-b border-accent/20 p-2 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-primary/60 text-content hover:bg-primary/70 active:bg-primary/80 transition-colors flex-shrink-0 touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
            aria-label="Close PDF viewer"
          >
            <X size={18} weight="bold" />
          </button>
          <h2 className="text-sm sm:text-lg font-semibold text-content truncate">
            {fileName}
          </h2>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Total pages indicator */}
          {totalPages > 0 && (
            <div className="bg-primary/40 rounded-lg px-2 py-1 sm:px-3 sm:py-2">
              <span className="text-xs sm:text-sm text-content">
                {totalPages} pages
              </span>
            </div>
          )}

          {/* Quality/Zoom controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-primary/40 rounded-lg p-1">
            <button
              onClick={zoomOut}
              className="p-2 sm:p-2 rounded text-content hover:bg-primary/60 active:bg-primary/70 touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
              aria-label={isMobile ? "Reduce quality" : "Zoom out"}
            >
              {isMobile ? (
                <Minus size={16} weight="bold" />
              ) : (
                <MagnifyingGlassMinus size={16} weight="bold" />
              )}
            </button>
            <span className="text-xs sm:text-sm text-content px-2 sm:px-2 min-w-[45px] sm:min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-2 sm:p-2 rounded text-content hover:bg-primary/60 active:bg-primary/70 touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
              aria-label={isMobile ? "Improve quality" : "Zoom in"}
            >
              {isMobile ? (
                <Plus size={16} weight="bold" />
              ) : (
                <MagnifyingGlassPlus size={16} weight="bold" />
              )}
            </button>
          </div>

          {/* Download button */}
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 sm:p-2 rounded-lg bg-accent text-content hover:bg-accent/90 active:bg-accent/80 transition-colors touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
              aria-label="Download PDF"
            >
              <Download size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-content/80">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadPDF}
                className="px-4 py-2 bg-accent text-content rounded-lg hover:bg-accent/90"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div
            ref={containerRef}
            className="min-h-full py-6"
            style={{ minWidth: 'fit-content' }}
          />
        )}
      </div>
    </div>
  );
}
