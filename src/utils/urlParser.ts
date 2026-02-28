import type { DirectoryNode } from '@/types/paper';
import { LEGACY_BASE_URL, PDF_BASE_URL } from '@/config/urls';

export function rewritePdfUrl(url: string): string {
  return url.replace(LEGACY_BASE_URL, PDF_BASE_URL);
}

export function rewritePaperUrls<T extends { url: string }>(papers: T[]): T[] {
  return papers.map((paper) => ({
    ...paper,
    url: rewritePdfUrl(paper.url),
  }));
}

export function rewriteDirectoryUrls(node: DirectoryNode): DirectoryNode {
  const rewritten: DirectoryNode = {
    ...node,
    path: rewritePdfUrl(node.path),
    meta: {
      ...node.meta,
      papers: rewritePaperUrls(node.meta.papers),
    },
  };

  if (rewritten.metadata) {
    rewritten.metadata = { ...rewritten.metadata, url: rewritePdfUrl(rewritten.metadata.url) };
  }

  rewritten.children = Object.fromEntries(
    Object.entries(node.children).map(([key, child]) => [key, rewriteDirectoryUrls(child)])
  ) as Record<string, DirectoryNode>;

  return rewritten;
}
