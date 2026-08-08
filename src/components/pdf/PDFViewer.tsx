"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, ArrowSquareOut, SpinnerGap } from "@phosphor-icons/react";
import { Paper } from "@/types/paper";
import { downloadFile } from "@/utils/download";
import { motion, AnimatePresence } from "framer-motion";

interface PDFViewerProps {
  paper: Paper;
  onClose: () => void;
}

export default function PDFViewer({ paper, onClose }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Mozilla PDF.js hosted viewer
  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(paper.url)}`;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(paper.url, paper.fileName, paper);
    } finally {
      setDownloading(false);
    }
  }, [paper, downloading]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-[95vw] h-[93vh] max-w-6xl bg-secondary rounded-2xl shadow-2xl border border-accent/30 flex flex-col overflow-hidden"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-accent/30 bg-primary/60 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 bg-accent/20 rounded-md text-xs font-medium">
                  {paper.year}
                </span>
                <span className="px-2 py-0.5 bg-primary/60 rounded-md text-xs font-medium">
                  {paper.examType}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-content truncate">
                {paper.fileName}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Download */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-brand/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <SpinnerGap size={16} className="animate-spin" />
                ) : (
                  <Download size={16} weight="bold" />
                )}
                <span className="hidden sm:inline">
                  {downloading ? "Downloading..." : "Download"}
                </span>
              </button>

              {/* Open in New Tab */}
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-content rounded-lg text-sm font-medium transition-all duration-200 hover:bg-accent/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <ArrowSquareOut size={16} weight="bold" />
                <span className="hidden sm:inline">New Tab</span>
              </a>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-2 text-content/70 hover:text-content hover:bg-accent/20 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                aria-label="Close preview"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </header>

          {/* PDF Content */}
          <div className="flex-1 relative bg-neutral-900">
            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-neutral-900">
                <div className="relative">
                  <div className="w-12 h-12 border-3 border-accent/20 border-t-brand rounded-full animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-content/80 text-sm font-medium">
                    Loading PDF...
                  </p>
                  <p className="text-content/50 text-xs mt-1">
                    This may take a moment
                  </p>
                </div>
              </div>
            )}

            <iframe
              src={viewerUrl}
              title={paper.fileName}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              allow="fullscreen"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
