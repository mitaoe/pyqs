import React from "react";

export function PDFLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] relative">
      {/* Background glow effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-96 h-96 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Main loader container */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Animated PDF Document Stack */}
        <div className="relative mb-8">
          {/* Document stack with 3D effect */}
          <div className="relative">
            {/* Back document */}
            <div 
              className="absolute w-20 h-28 rounded-lg border border-gray-600/50 transform rotate-3 translate-x-2 translate-y-2"
              style={{ backgroundColor: '#2a2a2a' }}
            ></div>
            
            {/* Middle document */}
            <div 
              className="absolute w-20 h-28 rounded-lg border border-gray-500/50 transform rotate-1 translate-x-1 translate-y-1"
              style={{ backgroundColor: '#333333' }}
            ></div>
            
            {/* Front document with content */}
            <div 
              className="relative w-20 h-28 rounded-lg border border-gray-400/50 flex flex-col items-center justify-center overflow-hidden"
              style={{ backgroundColor: '#3a3a3a' }}
            >
              {/* PDF text */}
              <div className="text-cyan-400 font-bold text-xs mb-2 tracking-wider">PDF</div>
              
              {/* Animated lines representing text */}
              <div className="w-12 space-y-1">
                <div className="h-0.5 bg-gray-500 rounded animate-pulse"></div>
                <div className="h-0.5 bg-gray-500 rounded animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-0.5 bg-gray-500 rounded animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <div className="h-0.5 bg-gray-500 rounded w-8 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              </div>
              
              {/* Scanning beam effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transform -skew-x-12 animate-scan"></div>
            </div>
          </div>

          {/* Orbiting particles */}
          <div className="absolute inset-0 w-32 h-32 -translate-x-6 -translate-y-2">
            <div className="absolute w-2 h-2 bg-cyan-400 rounded-full animate-orbit-1"></div>
            <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full animate-orbit-2"></div>
            <div className="absolute w-1 h-1 bg-purple-400 rounded-full animate-orbit-3"></div>
          </div>
        </div>

        {/* Loading text with gradient */}
        <div className="mb-6">
          <h3 className="text-2xl font-semibold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
            Loading Document
          </h3>
        </div>

        {/* Modern progress indicator */}
        <div className="relative w-80 h-1 bg-gray-700 rounded-full overflow-hidden mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full animate-progress"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full animate-shimmer"></div>
        </div>

        {/* Status message */}
        <p className="text-gray-400 text-sm animate-fade-in-out">
          Preparing your document for preview...
        </p>

        {/* Floating elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-float-1"></div>
          <div className="absolute top-1/3 right-1/4 w-0.5 h-0.5 bg-blue-400 rounded-full animate-float-2"></div>
          <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-purple-400 rounded-full animate-float-3"></div>
          <div className="absolute bottom-1/4 right-1/3 w-0.5 h-0.5 bg-cyan-300 rounded-full animate-float-4"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        
        @keyframes orbit-1 {
          0% { transform: rotate(0deg) translateX(40px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
        }
        
        @keyframes orbit-2 {
          0% { transform: rotate(120deg) translateX(35px) rotate(-120deg); }
          100% { transform: rotate(480deg) translateX(35px) rotate(-480deg); }
        }
        
        @keyframes orbit-3 {
          0% { transform: rotate(240deg) translateX(30px) rotate(-240deg); }
          100% { transform: rotate(600deg) translateX(30px) rotate(-600deg); }
        }
        
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        @keyframes float-1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-15px) rotate(-180deg); opacity: 0.8; }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-25px) rotate(90deg); opacity: 1; }
        }
        
        @keyframes float-4 {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-18px) rotate(-90deg); opacity: 0.7; }
        }
        
        .animate-scan { animation: scan 2s ease-in-out infinite; }
        .animate-orbit-1 { animation: orbit-1 3s linear infinite; }
        .animate-orbit-2 { animation: orbit-2 4s linear infinite; }
        .animate-orbit-3 { animation: orbit-3 5s linear infinite; }
        .animate-progress { animation: progress 2s ease-in-out infinite; }
        .animate-shimmer { animation: shimmer 1.5s ease-in-out infinite; }
        .animate-fade-in-out { animation: fade-in-out 2s ease-in-out infinite; }
        .animate-float-1 { animation: float-1 3s ease-in-out infinite; }
        .animate-float-2 { animation: float-2 4s ease-in-out infinite 0.5s; }
        .animate-float-3 { animation: float-3 3.5s ease-in-out infinite 1s; }
        .animate-float-4 { animation: float-4 4.5s ease-in-out infinite 1.5s; }
      `}</style>
    </div>
  );
}
