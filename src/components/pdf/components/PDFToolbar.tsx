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
    <div className="flex h-14 bg-slate-700 text-white text-sm overflow-x-auto whitespace-nowrap border-b border-slate-600 shadow-sm">
      {/* Left section */}
      <div className="flex items-center flex-shrink-0 px-4">
        <button
          onClick={() => goToPrevPage(numPages, {} as any, {} as any)}
          disabled={pageNumber <= 1}
          className="px-3 py-2 rounded hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-transparent flex items-center transition-colors"
          title="Previous Page"
        >
          <CaretLeft size={18} />
        </button>

        <button
          onClick={() => goToNextPage(numPages, {} as any, {} as any)}
          disabled={pageNumber >= numPages}
          className="px-3 py-2 rounded hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-transparent flex items-center transition-colors"
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
              }
            }}
            className="w-12 bg-slate-600 text-center border border-slate-500 rounded px-2 py-1 outline-none focus:border-blue-400 text-sm"
            min={1}
            max={numPages}
          />
          <span className="mx-2 text-slate-300">of {numPages}</span>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center flex-1 justify-center min-w-0 gap-2">
        <button
          onClick={handleZoomOut}
          className="px-3 py-2 rounded hover:bg-slate-600 flex items-center transition-colors"
          title="Zoom Out"
        >
          <MagnifyingGlassMinus size={18} />
        </button>

        <div className="relative">
          <select
            value={Math.round(scale * 100)}
            onChange={(e) => {
              // This would need to be handled by the zoom hook
              const newScale = Math.min(parseInt(e.target.value) / 100, 3.0);
              // setScale(newScale); // This would be passed from context
            }}
            className="bg-slate-600 border border-slate-500 rounded px-3 py-1 outline-none focus:border-blue-400 appearance-none text-sm min-w-[80px] cursor-pointer hover:bg-slate-500 transition-colors"
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

        <button
          onClick={handleZoomIn}
          className="px-3 py-2 rounded hover:bg-slate-600 flex items-center transition-colors"
          title="Zoom In"
        >
          <MagnifyingGlassPlus size={18} />
        </button>

        <div className="w-px h-6 bg-slate-500 mx-2" />

        <button
          onClick={handleZoomFit}
          className="px-3 py-2 rounded hover:bg-slate-600 text-sm flex items-center transition-colors"
          title="Fit to Page"
        >
          <ArrowsIn size={16} className="mr-1" />
          <span>Fit</span>
        </button>

        <button
          onClick={handleZoomActual}
          className="px-3 py-2 rounded hover:bg-slate-600 text-sm flex items-center transition-colors"
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
              className="px-3 py-2 rounded hover:bg-slate-600 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Previous PDF"
            >
              <CaretLeft size={18} />
            </button>

            <button
              onClick={goToNextPaper}
              disabled={!canGoNextPaper()}
              className="px-3 py-2 rounded hover:bg-slate-600 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Next PDF"
            >
              <CaretRight size={18} />
            </button>

            <div className="w-px h-6 bg-slate-500 mx-2" />
          </>
        )}

        <button
          onClick={handleDownload}
          className="px-3 py-2 rounded hover:bg-slate-600 flex items-center transition-colors"
          title="Download"
        >
          <Download size={18} />
        </button>

        <button
          onClick={() => window.print()}
          className="px-3 py-2 rounded hover:bg-slate-600 flex items-center transition-colors"
          title="Print"
        >
          <Printer size={18} />
        </button>

        <div className="w-px h-6 bg-slate-500 mx-2" />

        <button
          onClick={onClose}
          className="px-3 py-2 rounded hover:bg-slate-600 flex items-center transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
