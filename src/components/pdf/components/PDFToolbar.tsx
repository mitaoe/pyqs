import React from "react";
import {
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Download,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react";
import { usePDFContext } from "../context/PDFContext";
import { useResponsive } from "../hooks/useResponsive";

export function PDFToolbar() {
  const {
    pageNumber,
    numPages,
    scale,
    papers,
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

  const { isMobile } = useResponsive();

  return (
    <div className="flex h-12 text-white text-sm overflow-x-auto whitespace-nowrap border-b shadow-sm" style={{ backgroundColor: '#3b3b3b', borderBottomColor: '#2a2a2a' }}>
      {/* Left section - Page Display Only */}
      <div className={`flex items-center flex-shrink-0 ${isMobile ? 'px-2' : 'px-4'}`}>
        <div className="flex items-center">
          <span style={{ color: '#cccccc', fontSize: isMobile ? '12px' : '14px' }}>
            {isMobile ? `${pageNumber}/${numPages}` : `Page ${pageNumber} of ${numPages}`}
          </span>
        </div>
      </div>

      {/* Center section */}
      <div className={`flex items-center flex-1 justify-center min-w-0 ${isMobile ? 'gap-1' : 'gap-2'}`}>
        {/* Mobile: PDF Navigation on left side of zoom controls */}
        {isMobile && papers.length > 1 && (
          <button
            onClick={goToPrevPaper}
            disabled={!canGoPrevPaper()}
            className="px-2 py-1 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Previous PDF"
          >
            ←
          </button>
        )}

        <button
          onClick={handleZoomOut}
          className={`${isMobile ? 'px-2 py-1' : 'px-3 py-2'} rounded flex items-center transition-colors`}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Zoom Out"
        >
          <MagnifyingGlassMinus size={isMobile ? 16 : 18} />
        </button>

        <div className="relative">
          <select
            value={Math.round(scale * 100)}
            onChange={(e) => {
              const newScale = parseInt(e.target.value) / 100;
              updateZoomScale(newScale);
            }}
            className={`rounded outline-none appearance-none cursor-pointer transition-colors ${
              isMobile ? 'px-2 py-1 text-xs min-w-[60px]' : 'px-3 py-1 text-sm min-w-[80px]'
            }`}
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
          className={`${isMobile ? 'px-2 py-1' : 'px-3 py-2'} rounded flex items-center transition-colors`}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Zoom In"
        >
          <MagnifyingGlassPlus size={isMobile ? 16 : 18} />
        </button>

        {/* Mobile: PDF Navigation on right side of zoom controls */}
        {isMobile && papers.length > 1 && (
          <button
            onClick={goToNextPaper}
            disabled={!canGoNextPaper()}
            className="px-2 py-1 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Next PDF"
          >
            →
          </button>
        )}

        {/* Desktop: Fit and Actual Size buttons */}
        {!isMobile && (
          <>
            <div className="w-px h-6 mx-2" style={{ backgroundColor: '#555555' }} />

            <button
              onClick={handleZoomFit}
              className="px-3 py-2 text-sm rounded flex items-center transition-colors"
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
          </>
        )}
      </div>

      {/* Right section */}
      <div className={`flex items-center flex-shrink-0 ${isMobile ? 'px-2 gap-1' : 'px-4 gap-2'}`}>
        {/* Desktop: PDF Navigation */}
        {papers.length > 1 && !isMobile && (
          <>
            <button
              onClick={goToPrevPaper}
              disabled={!canGoPrevPaper()}
              className="px-3 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Previous PDF"
            >
              ← Prev PDF
            </button>

            <button
              onClick={goToNextPaper}
              disabled={!canGoNextPaper()}
              className="px-3 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4a4a4a')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Next PDF"
            >
              Next PDF →
            </button>

            <div className="w-px h-6 mx-2" style={{ backgroundColor: '#555555' }} />
          </>
        )}

        <button
          onClick={handleDownload}
          className={`${isMobile ? 'px-2 py-1' : 'px-3 py-2'} rounded flex items-center transition-colors`}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Download"
        >
          <Download size={isMobile ? 16 : 18} />
        </button>

        <button
          onClick={onClose}
          className={`${isMobile ? 'px-2 py-1' : 'px-3 py-2'} rounded flex items-center transition-colors`}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Close"
        >
          <X size={isMobile ? 16 : 18} />
        </button>
      </div>
    </div>
  );
}
