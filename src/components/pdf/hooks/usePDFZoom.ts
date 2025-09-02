import { useState, useEffect, useRef, useCallback } from "react";

export function usePDFZoom(initialScale: number = 1.0) {
  const [scale, setScale] = useState<number>(initialScale);
  const [internalScale, setInternalScale] = useState<number>(initialScale);
  const [currentScale, setCurrentScale] = useState<number>(initialScale);
  const [hasAutoZoomed, setHasAutoZoomed] = useState<boolean>(false);

  const zoomTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastPinchDistance = useRef<number>(0);
  const isZooming = useRef<boolean>(false);
  const zoomCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentScaleRef = useRef<number>(initialScale);

  // Sync internal scale with external scale prop
  useEffect(() => {
    if (scale && Math.abs(scale - internalScale) > 0.01) {
      setInternalScale(scale);
    }
  }, [scale, internalScale]);

  // Keep currentScaleRef updated with the latest scale value
  useEffect(() => {
    const latestScale = internalScale || scale || currentScale || 1.0;
    currentScaleRef.current = latestScale;
  }, [internalScale, scale, currentScale]);

  const updateZoomScale = useCallback(
    (newScale: number, centerX?: number, centerY?: number) => {
      const clampedScale = Math.max(0.6, Math.min(5.0, newScale));

      if (Math.abs(clampedScale - internalScale) > 0.01) {
        if (centerX !== undefined && centerY !== undefined) {
          zoomCenter.current = { x: centerX, y: centerY };
        }

        setInternalScale(clampedScale);
        setScale(clampedScale);
        currentScaleRef.current = clampedScale;

        if (zoomTimeout.current) {
          clearTimeout(zoomTimeout.current);
        }

        zoomTimeout.current = setTimeout(() => {
          isZooming.current = false;
        }, 100);

        isZooming.current = true;
      }
    },
    [internalScale]
  );

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(internalScale * 1.2, 5.0);
    updateZoomScale(newScale);
  }, [internalScale, updateZoomScale]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(internalScale / 1.2, 0.6);
    updateZoomScale(newScale);
  }, [internalScale, updateZoomScale]);

  const handleZoomActual = useCallback(() => {
    updateZoomScale(1.0);
  }, [updateZoomScale]);

  const handleZoomFit = useCallback(
    (
      containerRef: React.RefObject<HTMLDivElement | null>,
      pdfDoc: any,
      pageNumber: number
    ) => {
      if (containerRef.current && pdfDoc) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth - 80;

        pdfDoc.getPage(pageNumber).then((page: any) => {
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
    internalScale,
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
    isZooming: isZooming.current,
    currentScaleRef,
    lastPinchDistance,
    zoomCenter,
  };
}
