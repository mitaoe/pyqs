import type { Metadata } from 'next';

export async function generateMetadata(
  props: { searchParams: { path?: string } }
): Promise<Metadata> {

    const baseMetadata: Metadata = {
    title: 'MITAOE PYQs | Browse Directory Structure',
    description: 'Browse the directory structure of previous year question papers from MIT Academy of Engineering. Developer tool for viewing the raw paper organization.',
    keywords: 'MITAOE directory, paper organization, file structure, developer tools, MIT Alandi',
    robots: {
      index: false,
      follow: false
    }
  };
  
  const searchParams = await Promise.resolve(props.searchParams);
  const path = searchParams.path;
  
  if (path) {
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    
    return {
      title: `${lastSegment || 'Directory'} | MITAOE PYQs Browser`,
      description: `Browsing the ${lastSegment || path} directory of MITAOE previous year question papers. Developer tool for paper organization.`,
      keywords: `${lastSegment}, directory structure, MITAOE papers, file organization, developer tools`,
      robots: {
        index: false,
        follow: false
      }
    };
  }
  
  return baseMetadata;
} 