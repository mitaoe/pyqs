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
  const initialPinchDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
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
        // Two finger pinch zoom - prevent default to stop browser zoom
        e.preventDefault();
        e.stopPropagation();
        
        const distance = getTouchDistance(e.touches);
        initialPinchDistance.current = distance;
        lastPinchDistance.current = distance;
        initialScale.current = currentScaleRef.current;
        isZooming.current = true;

        // Debug log for mobile testing
        console.log('Pinch start:', { distance, initialScale: initialScale.current });

        // Get pinch center relative to the container
        const center = getTouchCenter(e.touches);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          zoomCenter.current = {
            x: center.x - rect.left,
            y: center.y - rect.top,
          };
        }
      } else if (
        tool === "hand" &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Single finger drag - only prevent default if we're actually dragging
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
    [tool, getTouchDistance, getTouchCenter, lastPinchDistance, zoomCenter, currentScaleRef]
  );

  const handleTouchMove = useCallback(
    (
      e: React.TouchEvent,
      containerRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (e.touches.length === 2 && isZooming.current) {
        // Handle pinch zoom - prevent default to stop browser zoom
        e.preventDefault();
        e.stopPropagation();
        
        const currentDistance = getTouchDistance(e.touches);

        if (initialPinchDistance.current > 0 && currentDistance > 0) {
          // Calculate the distance change ratio
          const distanceRatio = currentDistance / initialPinchDistance.current;
          
          // Convert to discrete 10% steps
          // If pinch out (ratio > 1), zoom in by 10% steps
          // If pinch in (ratio < 1), zoom out by 10% steps
          let targetScale = initialScale.current;
          
          if (distanceRatio > 1.15) {
            // Pinch out - zoom in by 10%
            const steps = Math.floor((distanceRatio - 1) / 0.15);
            targetScale = initialScale.current + (steps * 0.1);
          } else if (distanceRatio < 0.85) {
            // Pinch in - zoom out by 10%
            const steps = Math.floor((1 - distanceRatio) / 0.15);
            targetScale = initialScale.current - (steps * 0.1);
          }
          
          // Clamp the scale within bounds
          const newScale = Math.max(0.6, Math.min(5.0, targetScale));

          // Only update if there's a significant change (10% increment)
          if (Math.abs(newScale - currentScaleRef.current) >= 0.09) {
            console.log('Pinch zoom (10% steps):', { 
              currentDistance, 
              initialDistance: initialPinchDistance.current,
              distanceRatio, 
              targetScale,
              newScale, 
              currentScale: currentScaleRef.current 
            });

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
            
            // Update initial values to prevent continuous triggering
            initialPinchDistance.current = currentDistance;
            initialScale.current = newScale;
          }
        }

        lastPinchDistance.current = currentDistance;
      } else if (
        isDragging &&
        tool === "hand" &&
        containerRef.current &&
        e.touches.length === 1 &&
        !isZooming.current
      ) {
        // Handle single finger drag - prevent default to stop scrolling
        e.preventDefault();
        
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
      initialPinchDistance,
      initialScale,
    ]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        // Reset zoom state when less than 2 fingers
        isZooming.current = false;
        lastPinchDistance.current = 0;
        initialPinchDistance.current = 0;
        initialScale.current = currentScaleRef.current;
      }

      if (e.touches.length === 0) {
        // All fingers lifted - reset drag state
        setIsDragging(false);
      }
    },
    [currentScaleRef, lastPinchDistance]
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
