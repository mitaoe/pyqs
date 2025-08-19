import * as pdfjsLib from "pdfjs-dist";

// Simple and direct worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export { pdfjsLib };
export type { PDFDocumentProxy } from "pdfjs-dist";
