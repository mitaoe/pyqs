'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, CaretLeft, CaretRight } from '@phosphor-icons/react';
import * as pdfjsLib from 'pdfjs-dist';
import { Paper } from '@/types/paper';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  pdfUrl: string;
  fileName: string;
  onClose: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  papers?: Paper[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export default function PDFViewer({
  pdfUrl,
  fileName,
  onClose,
  onDownload,
  isDownloading = false,
  papers,
  currentIndex,
  onNavigate
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Touch zoom state - simplified and more reliable
  const touchState = useRef({
    isZooming: false,
    startDistance: 0,
    startScale: 1,
    lastScale: 1
  });

  // Load PDF document
  const loadPDF = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(pdfUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: false,
        disableAutoFetch: false,
        disableStream: false
      }).promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      canvasRefs.current = [];
      
      console.log('PDF loaded successfully:', {
        numPages: pdf.numPages,
        fingerprints: pdf.fingerprints
      });
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pdfUrl]);

  // Create canvas elements for all pages
  const createCanvasElements = useCallback(() => {
    if (!containerRef.current || !totalPages) return;

    console.log('Creating canvas elements for', totalPages, 'pages');
    
    // Clear existing content
    containerRef.current.innerHTML = '';
    canvasRefs.current = [];

    // Create wrapper for all pages
    const wrapper = document.createElement('div');
    wrapper.className = 'py-6 px-4 space-y-6';

    for (let i = 0; i < totalPages; i++) {
      const canvas = document.createElement('canvas');
      canvas.className = 'shadow-lg border border-gray-300 bg-white mx-auto block';
      canvas.style.display = 'block';
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      
      canvasRefs.current.push(canvas);
      wrapper.appendChild(canvas);
    }

    containerRef.current.appendChild(wrapper);
    
    // Immediately render after creating canvases
    if (pdfDoc) {
      setTimeout(() => renderAllPages(), 10);
    }
  }, [totalPages, pdfDoc]);

  // Render all pages - fixed version with proper PDF.js usage
  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || !totalPages || canvasRefs.current.length !== totalPages) {
      console.log('Cannot render - missing requirements:', {
        pdfDoc: !!pdfDoc,
        totalPages,
        canvasCount: canvasRefs.current.length
      });
      return;
    }

    console.log('=== RENDERING ALL PAGES ===');
    console.log('Scale:', scale, 'Total pages:', totalPages);

    try {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const canvas = canvasRefs.current[pageNum - 1];
        if (!canvas) {
          console.log('No canvas for page', pageNum);
          continue;
        }

        const page = await pdfDoc.getPage(pageNum);
        const context = canvas.getContext('2d');
        if (!context) {
          console.log('No context for page', pageNum);
          continue;
        }

        // Get the default viewport at scale 1.0
        const defaultViewport = page.getViewport({ scale: 1.0 });
        
        // Calculate the final scale
        let finalScale = scale;
        const containerWidth = containerRef.current?.clientWidth || 800;
        
        if (isMobile && containerWidth > 0) {
          // For mobile, calculate base scale to fit width, then apply user zoom
          const baseScale = (containerWidth - 64) / defaultViewport.width;
          finalScale = baseScale * scale;
        }

        // Get the scaled viewport with proper rotation handling
        const viewport = page.getViewport({ 
          scale: finalScale,
          rotation: 0  // Ensure no rotation is applied
        });
        
        console.log(`Page ${pageNum}: rendering at scale ${finalScale} (${viewport.width}x${viewport.height})`);

        // Set canvas size to match the viewport exactly
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        // Clear the canvas completely
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set white background
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Reset any transforms
        context.setTransform(1, 0, 0, 1, 0, 0);

        // Additional context cleanup for consistent rendering
        context.globalAlpha = 1.0;
        context.globalCompositeOperation = 'source-over';

        // Create the render context with minimal options
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        // Render the page with error handling
        try {
          await page.render(renderContext).promise;
          console.log(`Page ${pageNum} rendered successfully at ${viewport.width}x${viewport.height}`);
        } catch (renderError) {
          console.error(`Failed to render page ${pageNum}:`, renderError);
          // Try again with a fresh context
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          console.log(`Page ${pageNum} rendered on retry`);
        }
      }
      
      console.log('=== ALL PAGES RENDERED ===');
    } catch (err) {
      console.error('Error rendering pages:', err);
      setError('Failed to render PDF pages. Please try again.');
    }
  }, [pdfDoc, totalPages, scale, isMobile]);

  // Direct scale change handler - triggers immediate re-render
  const handleScaleChange = useCallback((newScale: number) => {
    console.log('Scale changing from', scale, 'to', newScale);
    setScale(newScale);
    
    // Immediate re-render after scale change
    setTimeout(() => {
      console.log('Triggering immediate re-render for scale:', newScale);
      renderAllPages();
    }, 10);
  }, [scale, renderAllPages]);

  // Touch distance calculation
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch event handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const distance = getDistance(e.touches[0], e.touches[1]);
      touchState.current = {
        isZooming: true,
        startDistance: distance,
        startScale: scale,
        lastScale: scale
      };
      
      console.log('Pinch started - distance:', distance, 'scale:', scale);
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && touchState.current.isZooming) {
      e.preventDefault();
      
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      
      if (touchState.current.startDistance > 0) {
        const ratio = currentDistance / touchState.current.startDistance;
        const newScale = Math.max(0.5, Math.min(4.0, touchState.current.startScale * ratio));
        
        if (Math.abs(newScale - touchState.current.lastScale) > 0.05) {
          console.log('Pinch zoom - new scale:', newScale);
          handleScaleChange(newScale);
          touchState.current.lastScale = newScale;
        }
      }
    }
  }, [handleScaleChange]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {    
    if (e.touches.length < 2) {
      touchState.current.isZooming = false;
      console.log('Pinch ended');
    }
  }, []);

  // Handle wheel zoom (desktop)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.5, Math.min(4.0, scale + delta));
      handleScaleChange(newScale);
    }
  }, [scale, handleScaleChange]);

  // Navigation functions
  const goToPrevious = () => {
    if (papers && currentIndex !== undefined && onNavigate && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (papers && currentIndex !== undefined && onNavigate && currentIndex < papers.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft') {
      if (papers && currentIndex !== undefined && onNavigate && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
    } else if (e.key === 'ArrowRight') {
      if (papers && currentIndex !== undefined && onNavigate && currentIndex < papers.length - 1) {
        onNavigate(currentIndex + 1);
      }
    } else if (e.key === '+' || e.key === '=') {
      const newScale = Math.min(scale + 0.2, 4.0);
      console.log('Keyboard zoom in to:', newScale);
      handleScaleChange(newScale);
    } else if (e.key === '-') {
      const newScale = Math.max(scale - 0.2, 0.5);
      console.log('Keyboard zoom out to:', newScale);
      handleScaleChange(newScale);
    }
  }, [onClose, papers, currentIndex, onNavigate, scale, handleScaleChange]);

  // Load PDF when component mounts
  useEffect(() => {
    loadPDF();
  }, [loadPDF]);

  // Create canvases when PDF loads
  useEffect(() => {
    if (pdfDoc && totalPages > 0) {
      createCanvasElements();
    }
  }, [pdfDoc, totalPages, createCanvasElements]);

  // Keyboard events
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileWidth = window.innerWidth < 768;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileWidth && hasTouchScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = { passive: false, capture: true };
    
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  // Prevent default zoom behaviors
  useEffect(() => {
    const preventGestures = (e: Event) => e.preventDefault();

    document.addEventListener('gesturestart', preventGestures, { passive: false });
    document.addEventListener('gesturechange', preventGestures, { passive: false });
    document.addEventListener('gestureend', preventGestures, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGestures);
      document.removeEventListener('gesturechange', preventGestures);
      document.removeEventListener('gestureend', preventGestures);
    };
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors flex-shrink-0"
            aria-label="Close PDF viewer"
          >
            <X size={20} weight="bold" />
          </button>
          <h2 className="text-sm sm:text-lg font-semibold text-white truncate">
            {fileName}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Document Navigation */}
          {papers && currentIndex !== undefined && onNavigate && (
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className="p-2 rounded text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous document"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <span className="text-xs text-white px-2 min-w-[60px] text-center">
                {currentIndex + 1} of {papers.length}
              </span>
              <button
                onClick={goToNext}
                disabled={currentIndex === papers.length - 1}
                className="p-2 rounded text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next document"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          )}

          {/* Zoom indicator */}
          <div className="bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-white font-medium">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Manual zoom buttons for testing */}
          <div className="flex gap-1">
            <button
              onClick={() => handleScaleChange(Math.max(scale - 0.2, 0.5))}
              className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors text-xs"
            >
              -
            </button>
            <button
              onClick={() => handleScaleChange(Math.min(scale + 0.2, 4.0))}
              className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors text-xs"
            >
              +
            </button>
          </div>

          {/* Download button */}
          {onDownload && (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label={isDownloading ? "Downloading..." : "Download PDF"}
            >
              <Download size={16} weight="bold" className={isDownloading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div 
        className="flex-1 overflow-auto bg-gray-100" 
        ref={containerRef}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: touchState.current.isZooming ? 'none' : 'pan-x pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          MozUserSelect: 'none',
        }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="bg-gray-800 border-t border-gray-700 p-2 text-center">
        <p className="text-xs text-gray-400">
          {isMobile 
            ? 'Pinch to zoom • Use +/- buttons • Arrow keys for documents • ESC to close'
            : 'Ctrl + scroll to zoom • Use +/- buttons • Arrow keys for documents • +/- keys • ESC to close'
          }
        </p>
      </div>
    </div>
  );
} 