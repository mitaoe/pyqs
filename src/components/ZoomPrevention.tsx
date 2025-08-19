"use client";

import { useEffect } from "react";

export default function ZoomPrevention() {
  useEffect(() => {
    // Prevent zoom with Ctrl + Mouse Wheel globally
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as Element;
        const isPDFModal = target.closest("[data-pdf-modal]");
        const isNavbar = target.closest('nav, [data-navbar], header, [role="navigation"]');

        // Don't prevent if it's PDF modal or navbar area
        if (!isPDFModal && !isNavbar) {
          e.preventDefault();
        }
      }
    };

    // Prevent zoom with keyboard shortcuts globally
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as Element;
        const isPDFModal = target.closest("[data-pdf-modal]");
        const isNavbar = target.closest('nav, [data-navbar], header, [role="navigation"]');

        // Don't prevent if it's PDF modal or navbar area
        if (!isPDFModal && !isNavbar) {
          switch (e.key) {
            case "=":
            case "+":
            case "-":
            case "0":
              e.preventDefault();
              break;
          }
        }
      }
    };

    // Prevent pinch zoom on touch devices (but allow navbar interactions)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        const target = e.target as Element;
        const isPDFModal = target.closest("[data-pdf-modal]");
        const isNavbar = target.closest('nav, [data-navbar], header, [role="navigation"]');

        // Don't prevent if it's PDF modal or navbar area
        if (!isPDFModal && !isNavbar) {
          e.preventDefault();
        }
      }
    };

    // Add event listeners
    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    window.addEventListener("keydown", handleGlobalKeydown, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      window.removeEventListener("keydown", handleGlobalKeydown);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  return null;
}
