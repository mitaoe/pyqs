import { useState, useEffect, useRef, useCallback } from "react";
import { Paper } from "@/types/paper";

// PDF.js types
interface PDFPageViewport {
  width: number;
  height: number;
}

interface PDFRenderContext {
  canvasContext: CanvasRenderingContext2D;
  viewport: PDFPageViewport;
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PDFPageProxy {
  getViewport: (params: { scale: number }) => PDFPageViewport;
  render: (renderContext: PDFRenderContext) => PDFRenderTask;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFLibrary {
  getDocument: (url: string) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: {
    workerSrc: string;
  };
}

declare global {
  interface Window {
    pdfjsLib: PDFLibrary;
  }
}

export function usePDFDocument(paper: Paper | null, isOpen: boolean) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF.js library
  useEffect(() => {
    if (typeof window !== "undefined" && !window.pdfjsLib) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      };
      document.head.appendChild(script);
    }
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !paper || !window.pdfjsLib) return;

    const loadPDF = async () => {
      setLoading(true);
      setError(null);

      try {
        const pdfUrl = `/api/download/proxy?url=${encodeURIComponent(
          paper.url
        )}`;
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    loadPDF();
  }, [isOpen, paper]);

  return {
    pdfDoc,
    numPages,
    loading,
    error,
  };
}
