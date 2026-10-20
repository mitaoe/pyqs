import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { SITE_NAME, SITE_URL, OG_IMAGE, PAPERS_OG_IMAGE } from "@/config/site"
import Providers from "./providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description:
    "A student-driven initiative to help engineering students prepare better for exams with organized subject-based question papers.",
  keywords:
    "MITAoE PYQs, MIT Academy of Engineering, previous year papers, question papers, MITAoE exam papers, MIT Alandi, engineering exam preparation, engineering subjects, batch download, previous semester papers, engineering exams, study materials, exam preparation",
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
    },
  },
  authors: [{ name: "MITAoE Students", url: SITE_URL }],
  creator: "MITAoE Students",
  publisher: "MITAoE Students",
  category: "Education",
  applicationName: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "MITAoE Previous Year Question Papers",
    description:
      "Browse by subject, year, or exam type. Download multiple papers with a single click.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "MITAoE PYQs Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MITAoE Previous Year Question Papers",
    description: "Access MIT Academy of Engineering question papers by subject.",
    images: [OG_IMAGE, PAPERS_OG_IMAGE],
    creator: "@mitaoe",
    site: "@mitaoe",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "pU3C4VTSXE2v7DFFiwp2acvtZO-RXj0cBBlfYsWBVn8",
  },
  appleWebApp: {
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
    capable: true,
  },
}

export const viewport: Viewport = {
  themeColor: "#18181b",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
