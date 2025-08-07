import { useState, useCallback } from "react";
import { Paper } from "@/types/paper";

export function usePDFPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);

  const openPreview = useCallback((paper: Paper, allPapers: Paper[]) => {
    setCurrentPaper(paper);
    setPapers(allPapers);
    setIsOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setCurrentPaper(null);
    setPapers([]);
  }, []);

  const navigateToPaper = useCallback((paper: Paper) => {
    setCurrentPaper(paper);
  }, []);

  return {
    isOpen,
    currentPaper,
    papers,
    openPreview,
    closePreview,
    navigateToPaper,
  };
}
