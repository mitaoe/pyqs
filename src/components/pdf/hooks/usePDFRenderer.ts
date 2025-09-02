import { useState, useEffect, useRef, useCallback } from "react";

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 100;

export function usePDFRenderer(
  pdfDoc: any,
  scale: number,
  internalScale: number
) {
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());

  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, PDFRenderTask>>(new Map());
  const renderingPages = useRef<Set<number>>(new Set());
  const pageScales = useRef<Map<number, number>>(new Map());

  // Track retry attempts per page to prevent infinite loops
  const retryAttempts = useRef<Map<number, number>>(new Map());

  // Cancel rendering for a specific page and reset retry count
  const cancelPageRender = useCallback((pageNum: number) => {
    const renderTask = renderTasks.current.get(pageNum);
    if (renderTask) {
      renderTask.cancel();
      renderTasks.current.delete(pageNum);
    }
    renderingPages.current.delete(pageNum);
    retryAttempts.current.delete(pageNum); // Reset retry count
  }, []);

  // Cancel all ongoing renders and reset all retry counts
  const cancelAllRenders = useCallback(() => {
    renderTasks.current.forEach((task) => {
      task.cancel();
    });
    renderTasks.current.clear();
    renderingPages.current.clear();
    retryAttempts.current.clear(); // Reset all retry counts
  }, []);

  // Render a specific PDF page with retry limit
  const renderPage = useCallback(
    async (pageNum: number, forceRender: boolean = false) => {
      if (!pdfDoc) return;

      const canvas = pageRefs.current.get(pageNum);
      if (!canvas) return;

      const currentScaleValue = internalScale || scale || 1.0;

      // Check if already rendered at current scale (unless forced)
      const lastRenderedScale = pageScales.current.get(pageNum);
      if (
        !forceRender &&
        lastRenderedScale === currentScaleValue &&
        renderedPages.has(pageNum)
      ) {
        return;
      }

      // Prevent concurrent rendering of the same page
      if (renderingPages.current.has(pageNum)) {
        return;
      }

      // Cancel any existing render task for this page
      cancelPageRender(pageNum);

      // Mark page as being rendered
      renderingPages.current.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const context = canvas.getContext("2d");

        if (!context) {
          renderingPages.current.delete(pageNum);
          return;
        }

        const viewport = page.getViewport({ scale: currentScaleValue });

        // Store current canvas content if it exists (for smooth transitions)
        const hasExistingContent = canvas.width > 0 && canvas.height > 0;
        let imageData: ImageData | null = null;
        
        if (hasExistingContent && lastRenderedScale) {
          try {
            imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          } catch (e) {
            // Ignore errors when getting image data
          }
        }

        // Set new canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        // If we have existing content, scale and draw it temporarily
        if (imageData && lastRenderedScale) {
          context.setTransform(1, 0, 0, 1, 0, 0);
          const scaleRatio = currentScaleValue / lastRenderedScale;
          context.scale(scaleRatio, scaleRatio);
          
          // Create temporary canvas for the old content
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imageData.width;
          tempCanvas.height = imageData.height;
          const tempContext = tempCanvas.getContext('2d');
          
          if (tempContext) {
            tempContext.putImageData(imageData, 0, 0);
            context.drawImage(tempCanvas, 0, 0);
          }
        } else {
          // Clear canvas if no existing content
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Reset transform for new render
        context.setTransform(1, 0, 0, 1, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTasks.current.set(pageNum, renderTask);

        await renderTask.promise;

        // Success - clean up and mark as rendered
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);
        retryAttempts.current.delete(pageNum); // Reset retry count on success
        pageScales.current.set(pageNum, currentScaleValue);
        setRenderedPages((prev) => new Set([...prev, pageNum]));
      } catch (err) {
        // Clean up on error
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);

        const errorMessage = (err as Error)?.message || "";
        const errorName = (err as Error)?.name || "";

        // Don't retry if render was cancelled
        if (errorName === "RenderingCancelledException") {
          return;
        }

        // Handle canvas conflicts with retry limit
        if (
          errorMessage.includes("canvas") &&
          errorMessage.includes("render")
        ) {
          const currentRetries = retryAttempts.current.get(pageNum) || 0;

          if (currentRetries < MAX_RETRY_ATTEMPTS) {
            retryAttempts.current.set(pageNum, currentRetries + 1);
            console.warn(
              `Canvas conflict for page ${pageNum}, retry ${
                currentRetries + 1
              }/${MAX_RETRY_ATTEMPTS}`
            );

            // Retry with exponential backoff
            setTimeout(() => {
              renderPage(pageNum, true);
            }, RETRY_DELAY * Math.pow(2, currentRetries));
          } else {
            console.error(
              `Max retries exceeded for page ${pageNum}, giving up`
            );
            retryAttempts.current.delete(pageNum);
          }
        } else {
          console.error(`Error rendering page ${pageNum}:`, err);
          retryAttempts.current.delete(pageNum);
        }
      }
    },
    [pdfDoc, internalScale, scale, cancelPageRender, renderedPages]
  );

  // Reset all state when PDF document changes
  const resetRenderer = useCallback(() => {
    cancelAllRenders();
    setRenderedPages(new Set());
    setVisiblePages(new Set());
    pageScales.current.clear();
    retryAttempts.current.clear();
    pageRefs.current.clear();
    pageContainerRefs.current.clear();
  }, [cancelAllRenders]);

  // Clean up retry attempts when document changes
  useEffect(() => {
    if (pdfDoc) {
      retryAttempts.current.clear();
    }
  }, [pdfDoc]);

  return {
    renderedPages,
    visiblePages,
    setVisiblePages,
    pageRefs,
    pageContainerRefs,
    renderPage,
    cancelAllRenders,
    setRenderedPages,
    resetRenderer,
  };
}
