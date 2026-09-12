import { useState, useEffect, useRef, useCallback } from "react";
import { type PDFDocumentProxy, type PDFPageProxy } from "@/lib/pdfConfig";

export function usePDFZoom(initialScale: number = 1.0) {
  const [scale, setScale] = useState<number>(initialScale);
  const [currentScale, setCurrentScale] = useState<number>(initialScale);
  const [hasAutoZoomed, setHasAutoZoomed] = useState<boolean>(false);

  const zoomTimeout = useRef<NodeJS.Timeout | null>(null);
  const isZooming = useRef<boolean>(false);
  const zoomCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentScaleRef = useRef<number>(initialScale);

  // Keep currentScaleRef updated with the latest scale value
  useEffect(() => {
    currentScaleRef.current = scale || currentScale || 1.0;
  }, [scale, currentScale]);

  const updateZoomScale = useCallback(
    (newScale: number, centerX?: number, centerY?: number) => {
      const clampedScale = Math.max(0.6, Math.min(5.0, newScale));

      // Use a smaller threshold for mobile to make zoom more responsive
      const threshold = window.innerWidth <= 768 ? 0.005 : 0.01;
      
      if (Math.abs(clampedScale - scale) > threshold) {
        if (centerX !== undefined && centerY !== undefined) {
          zoomCenter.current = { x: centerX, y: centerY };
        }

        setScale(clampedScale);
        currentScaleRef.current = clampedScale;

        if (zoomTimeout.current) {
          clearTimeout(zoomTimeout.current);
        }

        // Shorter timeout for mobile for more responsive zoom
        const timeoutDuration = window.innerWidth <= 768 ? 150 : 300;
        zoomTimeout.current = setTimeout(() => {
          isZooming.current = false;
        }, timeoutDuration);

        isZooming.current = true;
      }
    },
    [scale]
  );

  const handleZoomIn = useCallback(() => {
    // Use 10% increments for consistent zoom behavior
    const newScale = Math.min(scale + 0.1, 5.0);
    updateZoomScale(newScale);
  }, [scale, updateZoomScale]);

  const handleZoomOut = useCallback(() => {
    // Use 10% decrements for consistent zoom behavior
    const newScale = Math.max(scale - 0.1, 0.6);
    updateZoomScale(newScale);
  }, [scale, updateZoomScale]);

  const handleZoomActual = useCallback(() => {
    updateZoomScale(1.0);
  }, [updateZoomScale]);

  const handleZoomFit = useCallback(
    (
      containerRef: React.RefObject<HTMLDivElement | null>,
      pdfDoc: PDFDocumentProxy | null,
      pageNumber: number
    ) => {
      if (containerRef.current && pdfDoc) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth - 80;

        pdfDoc.getPage(pageNumber).then((page: PDFPageProxy) => {
          const viewport = page.getViewport({ scale: 1.0 });
          // Fit to width like Chrome PDF viewer
          const scaleX = containerWidth / viewport.width;
          const newScale = Math.min(scaleX, 5.0);
          updateZoomScale(Math.round(newScale * 100) / 100);
        });
      }
    },
    [updateZoomScale]
  );

  return {
    scale,
    internalScale: scale,
    currentScale,
    hasAutoZoomed,
    setScale,
    setCurrentScale,
    setHasAutoZoomed,
    updateZoomScale,
    handleZoomIn,
    handleZoomOut,
    handleZoomActual,
    handleZoomFit,
    currentScaleRef,
  };
}
