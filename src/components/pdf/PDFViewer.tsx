'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, Download, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale]);

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
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async (pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render PDF page.');
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft') {
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
      goToPage(currentPage + 1);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-secondary/95 backdrop-blur-sm border-b border-accent/20 p-2 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-primary/60 text-content hover:bg-primary/70 transition-colors flex-shrink-0"
            aria-label="Close PDF viewer"
          >
            <X size={18} weight="bold" />
          </button>
          <h2 className="text-sm sm:text-lg font-semibold text-content truncate">
            {fileName}
          </h2>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Page navigation */}
          {totalPages > 0 && (
            <div className="flex items-center gap-1 bg-primary/40 rounded-lg px-2 py-1 sm:px-3 sm:py-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 rounded text-content hover:bg-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={14} weight="bold" />
              </button>
              <span className="text-xs sm:text-sm text-content min-w-[60px] sm:min-w-[80px] text-center">
                {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded text-content hover:bg-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-primary/40 rounded-lg p-1">
            <button
              onClick={zoomOut}
              className="p-1.5 sm:p-2 rounded text-content hover:bg-primary/60"
              aria-label="Zoom out"
            >
              <MagnifyingGlassMinus size={14} weight="bold" />
            </button>
            <span className="text-xs sm:text-sm text-content px-1 sm:px-2 min-w-[35px] sm:min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-1.5 sm:p-2 rounded text-content hover:bg-primary/60"
              aria-label="Zoom in"
            >
              <MagnifyingGlassPlus size={14} weight="bold" />
            </button>
          </div>

          {/* Download button */}
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 sm:p-2 rounded-lg bg-accent text-content hover:bg-accent/90 transition-colors"
              aria-label="Download PDF"
            >
              <Download size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
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
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="shadow-lg border border-gray-300 bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
