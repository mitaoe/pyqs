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
  description: 'Access MITAOE (MIT Academy of Engineering Alandi) previous year question papers. A student-driven initiative to help engineering students prepare better for exams with organized subject-based question papers.',
  keywords: 'MITAOE PYQs, MIT Academy of Engineering, previous year papers, question papers, MITAOE exam papers, MIT Alandi, engineering exam preparation, engineering subjects, batch download, previous semester papers',
  icons: {
    icon: '/favicon.ico'
  },
  alternates: {
    canonical: 'https://mitaoe-pyqs.vercel.app',
  },
  authors: [
    { name: 'MITAOE Students' }
  ],
  creator: 'Aditya Kotkar',
  publisher: 'MITAOE Students',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'MITAOE Previous Year Question Papers',
    description: 'Free access to MIT Academy of Engineering previous year question papers. Browse by subject, year, or exam type. Download multiple papers with a single click.',
    url: 'https://mitaoe-pyqs.vercel.app',
    siteName: 'MITAOE PYQs',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://mitaoe-pyqs.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MITAOE PYQs Preview'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MITAOE Previous Year Question Papers',
    description: 'Access MIT Academy of Engineering question papers by subject',
    images: ['https://mitaoe-pyqs.vercel.app/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    }
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
        <meta name="google-site-verification" content="add-your-verification-code-here" />
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
