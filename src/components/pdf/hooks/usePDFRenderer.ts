import { useState, useEffect, useRef, useCallback } from "react";

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

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

  // Cancel rendering for a specific page
  const cancelPageRender = useCallback((pageNum: number) => {
    const renderTask = renderTasks.current.get(pageNum);
    if (renderTask) {
      renderTask.cancel();
      renderTasks.current.delete(pageNum);
    }
    renderingPages.current.delete(pageNum);
  }, []);

  // Cancel all ongoing renders
  const cancelAllRenders = useCallback(() => {
    renderTasks.current.forEach((task) => {
      task.cancel();
    });
    renderTasks.current.clear();
    renderingPages.current.clear();
  }, []);

  // Render a specific PDF page
  const renderPage = useCallback(
    async (pageNum: number, forceRender: boolean = false) => {
      if (!pdfDoc) return;

      const canvas = pageRefs.current.get(pageNum);
      if (!canvas) return;

      const currentScaleValue = internalScale || scale || 1.0;

      const lastRenderedScale = pageScales.current.get(pageNum);
      if (
        !forceRender &&
        lastRenderedScale === currentScaleValue &&
        renderedPages.has(pageNum)
      ) {
        return;
      }

      cancelPageRender(pageNum);

      if (renderingPages.current.has(pageNum)) {
        console.warn(`Page ${pageNum} is already being rendered, skipping...`);
        return;
      }

      renderingPages.current.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const context = canvas.getContext("2d");

        if (!context) {
          renderingPages.current.delete(pageNum);
          return;
        }

        const viewport = page.getViewport({ scale: currentScaleValue });

        const scaledWidth = viewport.width;
        const scaledHeight = viewport.height;

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = scaledWidth + "px";
        canvas.style.height = scaledHeight + "px";

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTasks.current.set(pageNum, renderTask);

        await renderTask.promise;

        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);
        pageScales.current.set(pageNum, currentScaleValue);
        setRenderedPages((prev) => new Set([...prev, pageNum]));
      } catch (err) {
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);

        const errorMessage = (err as Error)?.message || "";
        const errorName = (err as Error)?.name || "";

        if (errorName !== "RenderingCancelledException") {
          if (
            errorMessage.includes("canvas") &&
            errorMessage.includes("render")
          ) {
            console.warn(`Canvas conflict for page ${pageNum}, will retry...`);
            requestAnimationFrame(() => {
              renderPage(pageNum, true);
            });
          } else {
            console.error(`Error rendering page ${pageNum}:`, err);
          }
        }
      }
    },
    [pdfDoc, internalScale, scale, cancelPageRender, renderedPages]
  );

  return {
    renderedPages,
    visiblePages,
    setVisiblePages,
    pageRefs,
    pageContainerRefs,
    renderPage,
    cancelAllRenders,
    setRenderedPages,
  };
}
