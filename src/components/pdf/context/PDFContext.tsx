import React, { createContext, useContext, ReactNode } from "react";
import { Paper } from "@/types/paper";
import { type PDFDocumentProxy } from "@/lib/pdfConfig";

interface PDFContextType {
  // Document state
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  loading: boolean;
  error: string | null;

  // Navigation state
  pageNumber: number;
  setPageNumber: (page: number) => void;

  // Zoom state
  scale: number;
  internalScale: number;

  // Navigation functions
  canGoPrevPaper: () => boolean;
  canGoNextPaper: () => boolean;
  goToPrevPaper: () => void;
  goToNextPaper: () => void;

  // Zoom functions
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomActual: () => void;
  handleZoomFit: () => void;
  updateZoomScale: (newScale: number) => void;

  // Gesture handlers
  isDragging: boolean;
  tool: string;
  handleMouseDown: (
    e: React.MouseEvent,
    containerRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleMouseMove: (
    e: React.MouseEvent,
    containerRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleMouseUp: () => void;
  handleTouchStart: (
    e: React.TouchEvent,
    containerRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleTouchMove: (
    e: React.TouchEvent,
    containerRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;

  // Paper data
  paper: Paper | null;
  papers: Paper[];

  // Actions
  onClose: () => void;
  handleDownload: () => Promise<void>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  
  // Navigation control
  isNavigating?: boolean;
  setIsNavigating?: (navigating: boolean) => void;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

export function usePDFContext() {
  const context = useContext(PDFContext);
  if (context === undefined) {
    throw new Error("usePDFContext must be used within a PDFProvider");
  }
  return context;
}

interface PDFProviderProps {
  children: ReactNode;
  value: PDFContextType;
}

export function PDFProvider({ children, value }: PDFProviderProps) {
  return <PDFContext.Provider value={value}>{children}</PDFContext.Provider>;
}
