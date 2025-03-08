'use client';

import { ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: 'bottom' | 'top' | 'left' | 'right' | 'none';
  distance?: number;
  className?: string;
}

const fadeInVariants: Record<string, Variants> = {
  bottom: {
    hidden: { opacity: 0, y: (distance) => distance },
    visible: { opacity: 1, y: 0 }
  },
  top: {
    hidden: { opacity: 0, y: (distance) => -distance },
    visible: { opacity: 1, y: 0 }
  },
  left: {
    hidden: { opacity: 0, x: (distance) => -distance },
    visible: { opacity: 1, x: 0 }
  },
  right: {
    hidden: { opacity: 0, x: (distance) => distance },
    visible: { opacity: 1, x: 0 }
  },
  none: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  }
};

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  from = 'bottom',
  distance = 20,
  className = ''
}: FadeInProps) {
  const variants = fadeInVariants[from];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      custom={distance}
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