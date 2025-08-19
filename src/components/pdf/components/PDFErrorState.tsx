import React from "react";

interface PDFErrorStateProps {
  error: string;
}

export function PDFErrorState({ error }: PDFErrorStateProps) {
  return (
    <div className="flex items-center justify-center p-8 bg-white shadow-lg rounded-lg">
      <div className="text-red-600">{error}</div>
    </div>
  );
}
