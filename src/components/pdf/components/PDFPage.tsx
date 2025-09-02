import React from "react";

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
  return (
    <div
      key={pageNum}
      ref={(el) => {
        if (el) {
          pageContainerRefs.current.set(pageNum, el);
        }
      }}
      data-page={pageNum}
      className="bg-white shadow-md border border-gray-200 overflow-hidden"
      style={{
        minHeight: "400px",
        minWidth: "fit-content",
        contain: "layout style paint",
      }}
    >
      <canvas
        ref={(el) => {
          if (el) {
            pageRefs.current.set(pageNum, el);
          }
        }}
        className="block"
        style={{
          maxWidth: "none",
          width: "auto",
          height: "auto",
          display: "block",
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
        }}
      />
    </div>
  );
}
