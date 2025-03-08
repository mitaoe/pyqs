'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import LottieAnimation from './LottieAnimation';

interface GhostCursorProps {
  enabled?: boolean;
}

export default function GhostCursor({ enabled = true }: GhostCursorProps) {
  const [isClient, setIsClient] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springX = useSpring(mouseX, { 
    stiffness: 100, 
    damping: 20,
    mass: 0.5
  });
  
  const springY = useSpring(mouseY, { 
    stiffness: 100, 
    damping: 20,
    mass: 0.5
  });

  useEffect(() => {
    setIsClient(true);
    
    if (!enabled) return;
    
    const updateMousePosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    
    window.addEventListener('mousemove', updateMousePosition);
    
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, [enabled, mouseX, mouseY]);
  
  if (!isClient || !enabled) return null;
  
  return (
    <motion.div
      ref={cursorRef}
      className="pointer-events-none fixed left-0 top-0 z-50 h-20 w-20"
      style={{
        x: springX,
        y: springY,
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      <LottieAnimation animationName="cursor" height={80} width={80} />
    </motion.div>
  );
} 