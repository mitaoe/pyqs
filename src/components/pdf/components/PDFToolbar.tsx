import React from "react";
import {
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Download,
  CaretLeft,
  CaretRight,
  ArrowsOut,
  ArrowsIn,
  Printer,
} from "@phosphor-icons/react";
import { usePDFContext } from "../context/PDFContext";

export function PDFToolbar() {
  const {
    pageNumber,
    setPageNumber,
    numPages,
    scale,
    papers,
    goToPrevPage,
    goToNextPage,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
    handleZoomIn,
    handleZoomOut,
    handleZoomFit,
    handleZoomActual,
    updateZoomScale,
    handleDownload,
    onClose,
  } = usePDFContext();

  return (
    <div className="flex h-12 text-white text-sm overflow-x-auto whitespace-nowrap border-b shadow-sm" style={{ backgroundColor: '#3b3b3b', borderBottomColor: '#2a2a2a' }}>
      {/* Left section */}
      <div className="flex items-center flex-shrink-0 px-4">
        <button
          onClick={() => {
            if (pageNumber > 1) {
              const targetPage = pageNumber - 1;
              setPageNumber(targetPage);
              // Scroll to the page
              const pageElement = document.querySelector(`[data-page="${targetPage}"]`);
              if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          }}
          disabled={pageNumber <= 1}
          className="px-3 py-2 rounded disabled:opacity-50 disabled:hover:bg-transparent flex items-center transition-colors"
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Previous Page"
        >
          <CaretLeft size={18} />
        </button>

        <button
          onClick={() => {
            if (pageNumber < numPages) {
              const targetPage = pageNumber + 1;
              setPageNumber(targetPage);
              // Scroll to the page
              const pageElement = document.querySelector(`[data-page="${targetPage}"]`);
              if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          }}
          disabled={pageNumber >= numPages}
          className="px-3 py-2 rounded disabled:opacity-50 disabled:hover:bg-transparent flex items-center transition-colors"
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Next Page"
        >
          <CaretRight size={18} />
        </button>

        <div className="flex items-center px-3 whitespace-nowrap">
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => {
              const page = parseInt(e.target.value);
              if (page >= 1 && page <= numPages) {
                setPageNumber(page);
                // Scroll to the page
                const pageElement = document.querySelector(`[data-page="${page}"]`);
                if (pageElement) {
                  pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }
            }}
            className="w-12 text-center rounded px-2 py-1 outline-none text-sm"
            style={{ 
              backgroundColor: '#2a2a2a', 
              border: '1px solid #555555',
              color: 'white'
            }}
            onFocus={(e) => e.target.style.borderColor = '#0078d4'}
            onBlur={(e) => e.target.style.borderColor = '#555555'}
            min={1}
            max={numPages}
          />
          <span className="mx-2" style={{ color: '#cccccc' }}>of {numPages}</span>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center flex-1 justify-center min-w-0 gap-2">
        <button
          onClick={handleZoomOut}
          className="px-3 py-2 rounded flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Zoom Out"
        >
          <MagnifyingGlassMinus size={18} />
        </button>

        <div className="relative">
          <select
            value={Math.round(scale * 100)}
            onChange={(e) => {
              const newScale = parseInt(e.target.value) / 100;
              updateZoomScale(newScale);
            }}
            className="rounded px-3 py-1 outline-none appearance-none text-sm min-w-[80px] cursor-pointer transition-colors"
            style={{ 
              backgroundColor: '#2a2a2a', 
              border: '1px solid #555555',
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
            onFocus={(e) => e.target.style.borderColor = '#0078d4'}
            onBlur={(e) => e.target.style.borderColor = '#555555'}
          >
            <option value={Math.round(scale * 100)}>
              {Math.round(scale * 100)}%
            </option>
            <option value={60}>60%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
            <option value={200}>200%</option>
            <option value={300}>300%</option>
            <option value={400}>400%</option>
            <option value={500}>500%</option>
          </select>
        </div>

        <button
          onClick={handleZoomIn}
          className="px-3 py-2 rounded flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Zoom In"
        >
          <MagnifyingGlassPlus size={18} />
        </button>

        <div className="w-px h-6 mx-2" style={{ backgroundColor: '#555555' }} />

        <button
          onClick={handleZoomFit}
          className="px-3 py-2 rounded text-sm flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Fit to Page"
        >
          <ArrowsIn size={16} className="mr-1" />
          <span>Fit</span>
        </button>

        <button
          onClick={handleZoomActual}
          className="px-3 py-2 rounded text-sm flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Actual Size"
        >
          <ArrowsOut size={16} className="mr-1" />
          <span>100%</span>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center flex-shrink-0 px-4 gap-2">
        {/* PDF Navigation - only show if there are multiple papers */}
        {papers.length > 1 && (
          <>
            <button
              onClick={goToPrevPaper}
              disabled={!canGoPrevPaper()}
              className="px-3 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Previous PDF"
            >
              <CaretLeft size={18} />
            </button>

            <button
              onClick={goToNextPaper}
              disabled={!canGoNextPaper()}
              className="px-3 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Next PDF"
            >
              <CaretRight size={18} />
            </button>

            <div className="w-px h-6 mx-2" style={{ backgroundColor: '#555555' }} />
          </>
        )}

        <button
          onClick={handleDownload}
          className="px-3 py-2 rounded flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Download"
        >
          <Download size={18} />
        </button>

        <button
          onClick={() => window.print()}
          className="px-3 py-2 rounded flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Print"
        >
          <Printer size={18} />
        </button>

        <div className="w-px h-6 mx-2" style={{ backgroundColor: '#555555' }} />

        <button
          onClick={onClose}
          className="px-3 py-2 rounded flex items-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
