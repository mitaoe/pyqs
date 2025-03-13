import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperProvider } from "@/contexts/PaperContext";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import LoadingDataChecker from "@/components/middleware/LoadingDataChecker";
import ClientProvider from "@/components/ClientProvider";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MITAOE PYQs | MIT Academy of Engineering Previous Year Question Papers',
  description: 'Access MITAOE (MIT Academy of Engineering Alandi) previous year question papers. A student-driven initiative helping engineering students prepare better for exams.',
  keywords: 'MITAOE PYQs, MIT Academy of Engineering, previous year papers, question papers, MITAOE exam papers, MIT Alandi, engineering exam preparation',
  icons: {
    icon: '/favicon.ico'
  },
  openGraph: {
    title: 'MITAOE Previous Year Question Papers',
    description: 'Free access to MIT Academy of Engineering previous year question papers',
    url: 'https://mitaoe-pyqs.vercel.app',
    siteName: 'MITAOE PYQs',
    type: 'website'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://mitaoe-pyqs.vercel.app" />
        <meta name="theme-color" content="#18181b" />
      </head>
      <body className={inter.className}>
        <PaperProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <LoadingDataChecker>
              <ClientProvider enableGhost={true}>
                {children}
              </ClientProvider>
            </LoadingDataChecker>
          </Suspense>
        </PaperProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
