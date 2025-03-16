import type { Metadata } from 'next';

export async function generateMetadata(
  props: { searchParams: { subject?: string } }
): Promise<Metadata> {

    const baseMetadata: Metadata = {
    title: 'MITAOE Previous Year Question Papers | Browse by Subject',
    description: 'Browse MITAOE previous year question papers by subject. Find and download papers for your engineering courses at MIT Academy of Engineering.',
    keywords: 'MITAOE subjects, engineering papers, previous year papers, download question papers, MIT Alandi'
  };
  
  const searchParams = await Promise.resolve(props.searchParams);
  const subject = searchParams.subject;
  
  if (subject) {
    return {
      title: `${subject} Papers | MITAOE Previous Year Question Papers`,
      description: `Access previous year question papers for ${subject} at MIT Academy of Engineering (MITAOE). Download ${subject} exam papers for better exam preparation.`,
      keywords: `${subject}, MITAOE, previous year papers, question papers, ${subject} exams, engineering papers`,
      openGraph: {
        title: `${subject} Previous Year Papers | MITAOE`,
        description: `Download ${subject} previous year question papers from MIT Academy of Engineering to prepare for your exams.`,
        url: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`,
        siteName: 'MITAOE PYQs',
        type: 'website'
      },
      alternates: {
        canonical: `https://mitaoe-pyqs.vercel.app/papers?subject=${encodeURIComponent(subject)}`
      }
    };
  }
  
  return baseMetadata;
} 