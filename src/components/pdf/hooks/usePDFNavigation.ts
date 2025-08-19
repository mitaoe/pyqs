import { useState, useCallback } from "react";
import { Paper } from "@/types/paper";

export function usePDFNavigation(
  papers: Paper[],
  paper: Paper | null,
  onNavigate: (paper: Paper) => void
) {
  const [pageNumber, setPageNumber] = useState<number>(1);

  const scrollToPage = useCallback(
    (
      pageNum: number,
      pageContainerRefs: React.MutableRefObject<Map<number, HTMLDivElement>>,
      containerRef: React.RefObject<HTMLDivElement>
    ) => {
      const pageContainer = pageContainerRefs.current.get(pageNum);
      if (pageContainer && containerRef.current) {
        pageContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    },
    []
  );

  const goToPrevPage = useCallback(
    (
      numPages: number,
      pageContainerRefs: React.MutableRefObject<Map<number, HTMLDivElement>>,
      containerRef: React.RefObject<HTMLDivElement>
    ) => {
      const targetPage = Math.max(pageNumber - 1, 1);
      scrollToPage(targetPage, pageContainerRefs, containerRef);
    },
    [pageNumber, scrollToPage]
  );

  const goToNextPage = useCallback(
    (
      numPages: number,
      pageContainerRefs: React.MutableRefObject<Map<number, HTMLDivElement>>,
      containerRef: React.RefObject<HTMLDivElement>
    ) => {
      const targetPage = Math.min(pageNumber + 1, numPages);
      scrollToPage(targetPage, pageContainerRefs, containerRef);
    },
    [pageNumber, scrollToPage]
  );

  const canGoPrevPaper = useCallback(() => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    return currentIndex > 0;
  }, [papers, paper]);

  const canGoNextPaper = useCallback(() => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    return currentIndex < papers.length - 1;
  }, [papers, paper]);

  const goToPrevPaper = useCallback(() => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    if (currentIndex > 0) {
      onNavigate(papers[currentIndex - 1]);
    }
  }, [papers, paper, onNavigate]);

  const goToNextPaper = useCallback(() => {
    const currentIndex = papers.findIndex(
      (p) => p.fileName === paper?.fileName
    );
    if (currentIndex < papers.length - 1) {
      onNavigate(papers[currentIndex + 1]);
    }
  }, [papers, paper, onNavigate]);

  return {
    pageNumber,
    setPageNumber,
    goToPrevPage,
    goToNextPage,
    canGoPrevPaper,
    canGoNextPaper,
    goToPrevPaper,
    goToNextPaper,
    scrollToPage,
  };
}
