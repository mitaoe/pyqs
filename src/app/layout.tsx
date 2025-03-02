import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperProvider } from "@/contexts/PaperContext";
import AnalyticsWrapper from "@/components/analytics";
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://mitaoe-pyqs.vercel.app" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className={inter.className}>
        <PaperProvider>
          {children}
        </PaperProvider>
        <AnalyticsWrapper />
      </body>
    </html>
  );
}
