import type { Metadata } from 'next';

export async function generateMetadata(
  props: { searchParams: { subject?: string } }
): Promise<Metadata> {

    const baseMetadata: Metadata = {
    title: 'MITAoE Previous Year Question Papers | Browse by Subject',
    description: 'Browse MITAoE previous year question papers by subject. Find and download papers for your engineering courses at MIT Academy of Engineering.',
    keywords: 'MITAoE subjects, engineering papers, previous year papers, download question papers, MIT Alandi'
  };
  
  const searchParams = await Promise.resolve(props.searchParams);
  const subject = searchParams.subject;
  
  if (subject) {
    return {
      title: `${subject} Papers | MITAoE Previous Year Question Papers`,
      description: `Access previous year question papers for ${subject} at MIT Academy of Engineering (MITAoE). Download ${subject} exam papers for better exam preparation.`,
      keywords: `${subject}, MITAoE, previous year papers, question papers, ${subject} exams, engineering papers`,
      openGraph: {
        title: `${subject} Previous Year Papers | MITAoE`,
        description: `Download ${subject} previous year question papers from MIT Academy of Engineering to prepare for your exams.`,
        url: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`,
        siteName: 'MITAoE PYQs',
        type: 'website'
      },
      alternates: {
        canonical: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`
      }
    };
  }
  
  return baseMetadata;
} 