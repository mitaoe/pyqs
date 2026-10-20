import type { Metadata } from "next"
import { OG_IMAGE, PAPERS_OG_IMAGE, SITE_NAME, SITE_URL } from "@/config/site"

export const papersIndexMetadata: Metadata = {
  title: "MITAoE Previous Year Question Papers | Browse by Subject",
  description:
    "Browse MITAoE previous year question papers by subject. Find and download papers for your engineering courses at MIT Academy of Engineering.",
  keywords:
    "MITAoE subjects, engineering papers, previous year papers, download question papers, MIT Alandi, engineering exam preparation, study materials",
  openGraph: {
    title: "Browse MITAoE Previous Year Question Papers by Subject",
    description:
      "Find and download engineering question papers organized by subject. Access papers from all semesters and years.",
    url: `${SITE_URL}/papers`,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "MITAoE Papers Page Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse MITAoE Previous Year Question Papers by Subject",
    description: "Find and download engineering question papers organized by subject.",
    images: [PAPERS_OG_IMAGE],
  },
  alternates: {
    canonical: `${SITE_URL}/papers`,
  },
}

export function subjectPageTitle(subject: string): string {
  return `${subject} Papers | MITAoE Previous Year Question Papers`
}

export function subjectPageMetadata(subject: string): Metadata {
  const pageUrl = `${SITE_URL}/papers?subject=${encodeURIComponent(subject)}`

  return {
    title: subjectPageTitle(subject),
    description: `Access previous year question papers for ${subject} at MIT Academy of Engineering (MITAoE). Download ${subject} exam papers for better exam preparation.`,
    keywords: `${subject}, MITAoE, previous year papers, question papers, ${subject} exams, engineering papers, engineering education, exam preparation, study materials`,
    openGraph: {
      title: `${subject} Previous Year Papers | MITAoE`,
      description: `Download ${subject} previous year question papers from MIT Academy of Engineering to prepare for your exams.`,
      url: pageUrl,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: PAPERS_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${subject} Papers Preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${subject} Previous Year Papers | MITAoE`,
      description: `Download ${subject} previous year question papers from MIT Academy of Engineering.`,
      images: [PAPERS_OG_IMAGE],
    },
    alternates: {
      canonical: pageUrl,
    },
  }
}
