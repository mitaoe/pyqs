import { useState, useEffect } from "react";
import { Paper } from "@/types/paper";
import { pdfjsLib, type PDFDocumentProxy } from "@/lib/pdfConfig";

export function usePDFDocument(paper: Paper | null, isOpen: boolean) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !paper) return;

    const loadPDF = async () => {
      setLoading(true);
      setError(null);

      try {
        const pdfUrl = `/api/download/proxy?url=${encodeURIComponent(
          paper.url
        )}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
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
