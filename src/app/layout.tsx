import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperProvider } from "@/contexts/PaperContext";
import LoadingDataChecker from "@/components/middleware/LoadingDataChecker";
import ClientProvider from "@/components/ClientProvider";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://mitaoe-pyqs.vercel.app'),
  title: 'MITAoE PYQs',
  description: 'A student-driven initiative to help engineering students prepare better for exams with organized subject-based question papers.',
  keywords: 'MITAoE PYQs, MIT Academy of Engineering, previous year papers, question papers, MITAoE exam papers, MIT Alandi, engineering exam preparation, engineering subjects, batch download, previous semester papers, engineering exams, study materials, exam preparation',
  icons: {
    icon: '/favicon.ico'
  },
  alternates: {
    canonical: 'https://mitaoe-pyqs.vercel.app',
    languages: {
      'en-US': 'https://mitaoe-pyqs.vercel.app'
    }
  },
  authors: [
    { name: 'MITAoE Students', url: 'https://mitaoe-pyqs.vercel.app' }
  ],
  creator: 'MITAoE Students',
  publisher: 'MITAoE Students',
  category: 'Education',
  applicationName: 'MITAoE PYQs',
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  openGraph: {
    title: 'MITAoE Previous Year Question Papers',
    description: 'Browse by subject, year, or exam type. Download multiple papers with a single click.',
    url: 'https://mitaoe-pyqs.vercel.app',
    siteName: 'MITAoE PYQs',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://mitaoe-pyqs.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MITAoE PYQs Preview'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MITAoE Previous Year Question Papers',
    description: 'Access MIT Academy of Engineering question papers by subject.',
    images: ['https://mitaoe-pyqs.vercel.app/og-image.png', 'https://mitaoe-pyqs.vercel.app/papers-og-image.png'],
    creator: '@mitaoe',
    site: '@mitaoe'
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    }
  },
  verification: {
    google: 'pU3C4VTSXE2v7DFFiwp2acvtZO-RXj0cBBlfYsWBVn8'
  },
  appleWebApp: {
    title: 'MITAoE PYQs',
    statusBarStyle: 'black-translucent',
    capable: true
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
        <meta name="theme-color" content="#18181b" />
        <meta name="google-site-verification" content="pU3C4VTSXE2v7DFFiwp2acvtZO-RXj0cBBlfYsWBVn8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
      </body>
    </html>
  );
}
