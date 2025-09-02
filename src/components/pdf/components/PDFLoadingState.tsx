import React from "react";

export function PDFLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="flex flex-col items-center space-y-7">
        {/* Smooth Professional Spinner */}
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>

        {/* Relevant British Text */}
        <div className="text-white/75 text-xs font-light tracking-[0.25em] uppercase">
          Fetching
        </div>
      </div>
    </div>
  );
}
