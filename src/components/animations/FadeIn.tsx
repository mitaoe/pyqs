'use client';

import { ReactNode, useMemo } from 'react';
import { motion} from 'framer-motion';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: 'bottom' | 'top' | 'left' | 'right' | 'none';
  distance?: number;
  className?: string;
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  from = 'bottom',
  distance = 20,
  className = ''
}: FadeInProps) {
    const variants = useMemo(() => {
    switch (from) {
      case 'bottom':
        return {
          hidden: { opacity: 0, y: distance },
          visible: { opacity: 1, y: 0 }
        };
      case 'top':
        return {
          hidden: { opacity: 0, y: -distance },
          visible: { opacity: 1, y: 0 }
        };
      case 'left':
        return {
          hidden: { opacity: 0, x: -distance },
          visible: { opacity: 1, x: 0 }
        };
      case 'right':
        return {
          hidden: { opacity: 0, x: distance },
          visible: { opacity: 1, x: 0 }
        };
      case 'none':
      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 }
        };
    }
  }, [from, distance]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ 
        duration,
        delay,
        ease: [0.21, 0.5, 0.51, 1] // Custom easing for a more natural motion
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
} 