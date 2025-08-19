import React from "react";

export function PDFLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px] bg-white shadow-lg rounded-lg">
      {/* Animated PDF Icon */}
      <div className="relative mb-6">
        <div className="w-16 h-20 bg-white rounded-lg shadow-lg border-2 border-gray-200 flex items-center justify-center relative overflow-hidden">
          {/* PDF Icon */}
          <div className="text-red-500 font-bold text-xs">PDF</div>

          {/* Loading animation overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-50 animate-pulse"></div>

          {/* Scanning line animation */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-pulse"></div>
        </div>

        {/* Floating dots around the icon */}
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
        <div
          className="absolute -bottom-2 -left-2 w-2 h-2 bg-green-500 rounded-full animate-bounce"
          style={{ animationDelay: "0.2s" }}
        ></div>
        <div
          className="absolute top-1/2 -right-3 w-2 h-2 bg-purple-500 rounded-full animate-bounce"
          style={{ animationDelay: "0.4s" }}
        ></div>
      </div>

      {/* Loading text with typing animation */}
      <div className="text-gray-300 text-lg font-medium mb-4">
        <span className="inline-block animate-pulse">Loading PDF</span>
        <span className="inline-block animate-ping ml-1">.</span>
        <span
          className="inline-block animate-ping ml-0.5"
          style={{ animationDelay: "0.2s" }}
        >
          .
        </span>
        <span
          className="inline-block animate-ping ml-0.5"
          style={{ animationDelay: "0.4s" }}
        >
          .
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-64 h-2 bg-gray-600 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
      </div>

      {/* Loading message */}
      <p className="text-gray-400 text-sm mt-4 text-center max-w-xs">
        Preparing your document for preview...
      </p>
    </div>
  );
}
