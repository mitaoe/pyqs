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
    handleDownload,
    onClose,
  } = usePDFContext();

  return (
    <div className="flex h-10 sm:h-8 bg-gray-700 text-white text-xs overflow-x-auto whitespace-nowrap">
      {/* Left section */}
      <div className="flex items-center flex-shrink-0">
        <div className="w-px h-4 bg-gray-500 mx-1 hidden sm:block" />

        <button
          onClick={() => goToPrevPage(numPages, {} as any, {} as any)}
          disabled={pageNumber <= 1}
          className="px-1 sm:px-2 h-full hover:bg-gray-500 disabled:opacity-50 flex items-center"
          title="Previous Page"
        >
          <CaretLeft size={16} className="sm:w-3.5 sm:h-3.5" />
        </button>

        <button
          onClick={() => goToNextPage(numPages, {} as any, {} as any)}
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
              // This would need to be handled by the zoom hook
              const newScale = Math.min(parseInt(e.target.value) / 100, 3.0);
              // setScale(newScale); // This would be passed from context
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
  );
}
