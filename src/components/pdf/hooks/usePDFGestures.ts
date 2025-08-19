import { useState, useCallback, useRef } from "react";

export function usePDFGestures(
  updateZoomScale: (
    newScale: number,
    centerX?: number,
    centerY?: number
  ) => void,
  currentScaleRef: React.MutableRefObject<number>,
  lastPinchDistance: React.MutableRefObject<number>,
  zoomCenter: React.MutableRefObject<{ x: number; y: number }>
) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [scrollStart, setScrollStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const isZooming = useRef<boolean>(false);
  const tool = "hand"; // Always use hand tool

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;

    const touch1 = touches[0];
    const touch2 = touches[1];

    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches
  const getTouchCenter = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };

    const touch1 = touches[0];
    const touch2 = touches[1];

    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      containerRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (tool === "hand") {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        if (containerRef.current) {
          setScrollStart({
            x: containerRef.current.scrollLeft,
            y: containerRef.current.scrollTop,
          });
        }
        e.preventDefault();
      }
    },
    [tool]
  );

  const handleMouseMove = useCallback(
    (
      e: React.MouseEvent,
      containerRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (isDragging && tool === "hand" && containerRef.current) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        containerRef.current.scrollLeft = scrollStart.x - deltaX;
        containerRef.current.scrollTop = scrollStart.y - deltaY;
      }
    },
    [isDragging, tool, dragStart, scrollStart]
  );

  const handleMouseUp = useCallback(() => {
    if (tool === "hand") {
      setIsDragging(false);
    }
  }, [tool]);

  const handleTouchStart = useCallback(
    (
      e: React.TouchEvent,
      containerRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (e.touches.length === 2) {
        // Two finger pinch zoom
        const distance = getTouchDistance(e.touches);
        lastPinchDistance.current = distance;
        isZooming.current = true;

        // Get pinch center
        const center = getTouchCenter(e.touches);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          zoomCenter.current = {
            x: center.x - rect.left,
            y: center.y - rect.top,
          };
        }

        e.preventDefault();
      } else if (
        tool === "hand" &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Single finger drag
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX, y: touch.clientY });
        if (containerRef.current) {
          setScrollStart({
            x: containerRef.current.scrollLeft,
            y: containerRef.current.scrollTop,
          });
        }
      }
    },
    [tool, getTouchDistance, getTouchCenter, lastPinchDistance, zoomCenter]
  );

  const handleTouchMove = useCallback(
    (
      e: React.TouchEvent,
      containerRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (e.touches.length === 2 && isZooming.current) {
        // Handle pinch zoom
        const currentDistance = getTouchDistance(e.touches);

        if (lastPinchDistance.current > 0) {
          const scaleChange = currentDistance / lastPinchDistance.current;
          const newScale = currentScaleRef.current * scaleChange;

          // Get current pinch center
          const center = getTouchCenter(e.touches);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = center.x - rect.left;
            const centerY = center.y - rect.top;
            updateZoomScale(newScale, centerX, centerY);
          } else {
            updateZoomScale(newScale);
          }
        }

        lastPinchDistance.current = currentDistance;
        e.preventDefault();
      } else if (
        isDragging &&
        tool === "hand" &&
        containerRef.current &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Handle single finger drag
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStart.x;
        const deltaY = touch.clientY - dragStart.y;

        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = scrollStart.x - deltaX;
            containerRef.current.scrollTop = scrollStart.y - deltaY;
          }
        });
      }
    },
    [
      isDragging,
      tool,
      dragStart,
      scrollStart,
      getTouchDistance,
      getTouchCenter,
      updateZoomScale,
      currentScaleRef,
      lastPinchDistance,
    ]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 0) {
        isZooming.current = false;
        lastPinchDistance.current = 0;
      }

      if (tool === "hand") {
        setIsDragging(false);
      }
    },
    [tool, lastPinchDistance]
  );

  return {
    isDragging,
    tool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
