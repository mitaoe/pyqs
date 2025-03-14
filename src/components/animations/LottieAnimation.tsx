'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface LottieJSON {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: unknown[];
  layers: unknown[];
  [key: string]: unknown;
}

const Lottie = dynamic(() => import('lottie-react'), { 
  ssr: false,
  loading: () => <div className="animate-pulse bg-accent/20 rounded-lg h-full w-full" />
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottiePlayerRef = any; // Using any here is necessary due to complex lottie-react types

interface LottieAnimationProps {
  animationData?: LottieJSON;
  animationName?: 'loading' | 'cursor';
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  width?: number | string;
  height?: number | string;
  speed?: number;
}

export default function LottieAnimation({
  animationData,
  animationName,
  loop = true,
  autoplay = true,
  className = '',
  width = '100%',
  height = '100%',
  speed = 1,
}: LottieAnimationProps) {
  const lottieRef = useRef<LottiePlayerRef>(null);
  const [isClient, setIsClient] = useState(false);
  const [loadedAnimation, setLoadedAnimation] = useState<LottieJSON | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function loadAnimation() {
      if (animationName && !loadedAnimation) {
        try {
          const response = await fetch(`/animations/${animationName}.json`);
          const animData = await response.json();
          setLoadedAnimation(animData);
        } catch (error) {
          console.error(`Failed to load animation: ${animationName}`, error);
          setHasError(true);
        }
      }
    }

    setIsClient(true);
    loadAnimation();
  }, [animationName, loadedAnimation]);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(speed);
    }
  }, [speed]);

  if (!isClient || hasError) {
    return <div className="animate-pulse bg-accent/20 rounded-lg h-full w-full" style={{ width, height }} />;
  }

  const animData = animationData || loadedAnimation;
  if (!animData) {
    return <div className="animate-pulse bg-accent/20 rounded-lg h-full w-full" style={{ width, height }} />;
  }

  return (
    <div className={className} style={{ width, height }}>
      <Lottie
        animationData={animData}
        loop={loop}
        autoplay={autoplay}
        lottieRef={lottieRef}
        style={{ width: '100%', height: '100%' }}
        renderer="svg"
      />
    </div>
  );
} 