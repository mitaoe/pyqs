import type { Metadata } from 'next';

export async function generateMetadata(
  props: { searchParams: { subject?: string } }
): Promise<Metadata> {

  const baseMetadata: Metadata = {
    title: 'MITAoE Previous Year Question Papers | Browse by Subject',
    description: 'Browse MITAoE previous year question papers by subject. Find and download papers for your engineering courses at MIT Academy of Engineering.',
    keywords: 'MITAoE subjects, engineering papers, previous year papers, download question papers, MIT Alandi, engineering exam preparation, study materials',
    openGraph: {
      title: 'Browse MITAoE Previous Year Question Papers by Subject',
      description: 'Find and download engineering question papers organized by subject. Access papers from all semesters and years.',
      url: 'https://mitaoe-pyqs.vercel.app/papers',
      siteName: 'MITAoE PYQs',
      type: 'website',
      images: [
        {
          url: 'https://mitaoe-pyqs.vercel.app/og-image.png',
          width: 1200,
          height: 630,
          alt: 'MITAoE Papers Page Preview'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Browse MITAoE Previous Year Question Papers by Subject',
      description: 'Find and download engineering question papers organized by subject.',
      images: ['https://mitaoe-pyqs.vercel.app/papers-og-image.png']
    },
    alternates: {
      canonical: 'https://mitaoe-pyqs.vercel.app/papers'
    }
  };

  const searchParams = await Promise.resolve(props.searchParams);
  const subject = searchParams.subject;

  if (subject) {
    return {
      title: `${subject} Papers | MITAoE Previous Year Question Papers`,
      description: `Access previous year question papers for ${subject} at MIT Academy of Engineering (MITAoE). Download ${subject} exam papers for better exam preparation.`,
      keywords: `${subject}, MITAoE, previous year papers, question papers, ${subject} exams, engineering papers, engineering education, exam preparation, study materials`,
      openGraph: {
        title: `${subject} Previous Year Papers | MITAoE`,
        description: `Download ${subject} previous year question papers from MIT Academy of Engineering to prepare for your exams.`,
        url: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`,
        siteName: 'MITAoE PYQs',
        type: 'website',
        images: [
          {
            url: 'https://mitaoe-pyqs.vercel.app/papers-og-image.png',
            width: 1200,
            height: 630,
            alt: `${subject} Papers Preview`
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title: `${subject} Previous Year Papers | MITAoE`,
        description: `Download ${subject} previous year question papers from MIT Academy of Engineering.`,
        images: ['https://mitaoe-pyqs.vercel.app/papers-og-image.png']
      },
      alternates: {
        canonical: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`
      }
    };
  }

  return baseMetadata;
}