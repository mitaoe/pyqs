import { useState, useEffect } from "react";
import { Paper } from "@/types/paper";
import { pdfjsLib, type PDFDocumentProxy } from "@/lib/pdfConfig";
import { getCacheManager } from "@/lib/cache/manager";

export function usePDFDocument(
  paper: Paper | null, 
  isOpen: boolean,
  onFailure?: () => void
) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !paper) return;

    const loadPDF = async () => {
      setLoading(true);
      setError(null);
      setFromCache(false);

      try {
        const cacheManager = getCacheManager();
        
        // First, try to get PDF from cache
        const cachedData = await cacheManager.getPdf(paper.url);
        
        let pdfData: ArrayBuffer;
        
        if (cachedData) {
          // Use cached data
          pdfData = cachedData;
          setFromCache(true);
        } else {
          // Fetch from network and cache it
          const pdfUrl = `/api/download/proxy?url=${encodeURIComponent(paper.url)}`;
          const response = await fetch(pdfUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          pdfData = await response.arrayBuffer();
          
          // Store in cache for future use
          await cacheManager.storePdf(
            paper.url,
            pdfData,
            paper.fileName,
            paper.subject,
            paper.year
          );
        }

        // Load PDF document from data
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF");
        setLoading(false);
        onFailure?.();
      }
    };

    loadPDF();
  }, [isOpen, paper, onFailure]);

  return {
    pdfDoc,
    numPages,
    loading,
    error,
    fromCache,
  };
}
