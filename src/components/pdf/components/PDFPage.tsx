import React, { useState, useEffect } from "react";
import { useResponsive } from "../hooks/useResponsive";
import { usePDFContext } from "../context/PDFContext";

interface PDFPageProps {
  pageNum: number;
  pageContainerRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  pageRefs: React.MutableRefObject<Map<number, HTMLCanvasElement>>;
}

export function PDFPage({
  pageNum,
  pageContainerRefs,
  pageRefs,
}: PDFPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { isMobile } = useResponsive();
  const { scale, internalScale } = usePDFContext();
  
  // On mobile, only constrain width when scale is 1.0 or less (initial fit)
  const currentScale = internalScale || scale;
  const shouldConstrainWidth = isMobile && currentScale <= 1.0;

  useEffect(() => {
    const canvas = pageRefs.current.get(pageNum);
    if (canvas) {
      // Monitor canvas for content changes
      const checkContent = () => {
        if (canvas.width > 0 && canvas.height > 0) {
          setIsLoading(false);
        }
      };

      // Check immediately and set up observer
      checkContent();
      
      // Use MutationObserver to detect when canvas gets content
      const observer = new MutationObserver(checkContent);
      observer.observe(canvas, { 
        attributes: true, 
        attributeFilter: ['width', 'height'] 
      });

      return () => observer.disconnect();
    }
  }, [pageNum, pageRefs]);

  return (
    <div
      key={pageNum}
      ref={(el) => {
        if (el) {
          pageContainerRefs.current.set(pageNum, el);
        }
      }}
      data-page={pageNum}
      className="bg-white shadow-md border border-gray-200 relative"
      style={{
        minHeight: isMobile ? "300px" : "400px",
        minWidth: shouldConstrainWidth ? "100%" : "fit-content",
        maxWidth: shouldConstrainWidth ? "100%" : "none",
        width: shouldConstrainWidth ? "100%" : "auto",
        contain: "layout style paint",
        overflow: shouldConstrainWidth ? "hidden" : "visible",
        touchAction: 'none', // Prevent browser zoom on individual pages
      }}
    >
      {/* Loading placeholder */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: '#f8f9fa' }}
        >
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm text-gray-500">Loading page {pageNum}...</span>
          </div>
        </div>
      )}
      
      <canvas
        ref={(el) => {
          if (el) {
            pageRefs.current.set(pageNum, el);
          }
        }}
        className="block"
        style={{
          maxWidth: shouldConstrainWidth ? "100%" : "none",
          width: shouldConstrainWidth ? "100%" : "auto",
          height: "auto",
          display: "block",
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
          // Smooth transitions during zoom
          transition: "opacity 0.2s ease-in-out",
          opacity: isLoading ? 0 : 1,
          touchAction: 'none', // Prevent browser zoom on canvas
        }}
      />
    </div>
  );
}
