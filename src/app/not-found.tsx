'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { House } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import LottieAnimation from '@/components/animations/LottieAnimation';
import FadeIn from '@/components/animations/FadeIn';

// Export the actual 404 component
export default function NotFound() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  const buttonClasses = "flex h-14 w-[180px] items-center justify-center overflow-hidden rounded-full px-4 text-sm font-medium text-primary shadow-lg shadow-white/5";

  return (
    <Layout>
      <div className="flex min-h-[76vh] flex-col items-center justify-center px-4 text-center">
        {/* Main animation section */}
        <FadeIn from="top" duration={0.8}>
          <div className="relative mb-6">
            <div className="h-80 w-80 sm:h-96 sm:w-96">
              <LottieAnimation 
                animationName="cursor" 
                loop={true}
                autoplay={true}
                className="h-full w-full"
                speed={1.2}
              />
            </div>
          </div>
        </FadeIn>
        
        {/* Ghost message of 404 */}
        <FadeIn from="bottom" delay={0.3} duration={0.5}>
          <h2 className="mb-4 bg-white/70 bg-clip-text text-2xl font-medium tracking-tight text-transparent sm:text-3xl">
            This ghost took a wrong turn
          </h2>
        </FadeIn>

        {/* Return home button */}
        <FadeIn delay={0.4} duration={0.4}>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Link
              href="/"
              className={`${buttonClasses} bg-white/90 backdrop-blur-md hover:bg-content/95`}
            >
              <House weight="bold" className="mr-2" size={20} />
              <span>Go Home</span>
            </Link>
          </motion.div>
        </FadeIn>
      </div>
    </Layout>
  );
} 