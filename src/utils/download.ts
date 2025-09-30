import { toast } from 'sonner';
import { Paper } from '@/types/paper';
import { getCacheManager } from '@/lib/cache/manager';

export async function downloadFile(url: string, fileName: string, paper?: Paper): Promise<boolean> {
  try {
    const cacheManager = getCacheManager();

    // Check cache first
    const cachedData = await cacheManager.getPdf(url);

    let blob: Blob;

    if (cachedData) {
      // Use cached version
      blob = new Blob([cachedData], { type: 'application/pdf' });
    } else {
      // Fetch from network
      const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const contentDisposition = response.headers.get('content-disposition');
      const serverFileName = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/["']/g, '')
        : null;

      if (serverFileName) {
        fileName = serverFileName;
      }

      blob = await response.blob();

      // Cache the downloaded file for future use (silently)
      if (paper) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          await cacheManager.storePdf(
            url,
            arrayBuffer,
            fileName,
            paper.subject || 'Unknown',
            paper.year || 'Unknown'
          );
        } catch (cacheError) {
          console.warn('Failed to cache downloaded file:', cacheError);
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    return true;
  } catch (error) {
    console.error('Download failed:', error);
    toast.error('Failed to download file. Please try again.');
    return false;
  }
}

export interface BatchDownloadProgress {
  totalPapers: number;
  completed: number;
  status: 'preparing' | 'downloading' | 'processing' | 'sending' | 'complete' | 'error';
  currentPaper?: string;
  error?: string;
  percentage?: number;
}

export type ProgressCallback = (progress: BatchDownloadProgress) => void;

// Format filename for ZIP - replace spaces with underscores and include filters
function formatZipFilename(papers: Paper[], filters: Record<string, string[]>): string {
  const subject = papers[0]?.standardSubject || papers[0]?.subject || '';
  const sanitizedSubject = subject.replace(/\s+/g, '_');

  let filename = sanitizedSubject ? `${sanitizedSubject}_Papers` : 'MITAoE_Papers';

  // Add filters to filename if they exist
  if (filters.years?.length) {
    filename += `_${filters.years.join('-')}`;
  }

  if (filters.examTypes?.length) {
    filename += `_${filters.examTypes.join('-')}`;
  }

  return `${filename}.zip`;
}

export async function batchDownloadPapers(
  papers: Paper[],
  filters: Record<string, string[]> = {},
  onProgress?: ProgressCallback
): Promise<boolean> {
  try {
    if (!papers || papers.length === 0) {
      toast.error('No papers selected for download');
      return false;
    }

    // Deduplicate papers by URL to avoid duplicate requests
    const uniquePapers = papers.reduce((acc, paper) => {
      if (!acc.some(p => p.url === paper.url)) {
        acc.push(paper);
      }
      return acc;
    }, [] as Paper[]);

    // Validate number of papers
    if (uniquePapers.length > 50) {
      const errorMsg = 'Maximum 50 papers can be downloaded at once';
      toast.error(errorMsg);
      const progress: BatchDownloadProgress = {
        totalPapers: uniquePapers.length,
        completed: 0,
        status: 'error',
        error: errorMsg,
        percentage: 0
      };
      onProgress?.(progress);
      return false;
    }

    // Dynamic import JSZip to reduce bundle size
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const cacheManager = getCacheManager();

    // Initialize progress
    const progress: BatchDownloadProgress = {
      totalPapers: uniquePapers.length,
      completed: 0,
      status: 'preparing',
      percentage: 0
    };

    onProgress?.(progress);

    let successCount = 0;
    let errorCount = 0;
    let cacheHitCount = 0;
    let networkFetchCount = 0;

    // Keep track of filenames to avoid duplicates
    const filenameMap = new Map<string, number>();

    // Process each paper
    for (let i = 0; i < uniquePapers.length; i++) {
      const paper = uniquePapers[i];

      try {
        progress.status = 'downloading';
        progress.completed = i;
        progress.percentage = Math.round((i / uniquePapers.length) * 80);
        progress.currentPaper = `Processing ${paper.fileName}...`;
        onProgress?.(progress);

        let pdfData: ArrayBuffer | null = null;

        // Check cache first
        pdfData = await cacheManager.getPdf(paper.url);

        if (pdfData) {
          cacheHitCount++;
          progress.currentPaper = `${paper.fileName} (cached - instant!)`;
          onProgress?.(progress);
        } else {
          // Fetch via proxy
          networkFetchCount++;
          progress.currentPaper = `Downloading ${paper.fileName}...`;
          onProgress?.(progress);

          const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(paper.url)}`;
          const response = await fetch(proxyUrl);

          if (!response.ok) {
            console.error(`Failed to fetch ${paper.url}, status: ${response.status}`);
            errorCount++;
            continue;
          }

          pdfData = await response.arrayBuffer();

          // Cache for future use
          try {
            await cacheManager.storePdf(
              paper.url,
              pdfData,
              paper.fileName,
              paper.subject || 'Unknown',
              paper.year || 'Unknown'
            );
          } catch (cacheError) {
            console.warn('Failed to cache PDF:', cacheError);
            // Continue anyway - caching failure shouldn't break download
          }
        }

        if (pdfData) {
          // Handle duplicate filenames by adding a suffix
          let fileName = paper.fileName;
          if (!fileName.toLowerCase().endsWith('.pdf')) {
            fileName += '.pdf';
          }

          if (filenameMap.has(fileName)) {
            const count = filenameMap.get(fileName)! + 1;
            filenameMap.set(fileName, count);
            const nameParts = fileName.split('.');
            fileName = `${nameParts[0]}_${count}.${nameParts[1]}`;
          } else {
            filenameMap.set(fileName, 1);
          }

          // Add to ZIP
          zip.file(fileName, pdfData);
          successCount++;
        }

      } catch (error) {
        console.error(`Error processing ${paper.fileName}:`, error);
        errorCount++;
      }
    }

    if (successCount === 0) {
      const errorMsg = 'Failed to download any papers';
      progress.status = 'error';
      progress.error = errorMsg;
      progress.percentage = 0;
      onProgress?.(progress);
      toast.error(errorMsg);
      return false;
    }

    // Create ZIP file
    progress.status = 'processing';
    progress.percentage = 85;
    progress.completed = uniquePapers.length;
    progress.currentPaper = `Creating ZIP file with ${successCount} papers...`;
    onProgress?.(progress);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9  // Maximum compression level
      }
    });

    // Prepare download
    progress.status = 'sending';
    progress.percentage = 95;
    progress.currentPaper = 'Preparing download...';
    onProgress?.(progress);

    const zipFileName = formatZipFilename(uniquePapers, filters);
    const objectUrl = URL.createObjectURL(zipBlob);

    // Create download link
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    // Complete
    progress.status = 'complete';
    progress.percentage = 100;

    let completionMessage = `Downloaded ${successCount} papers successfully`;
    if (cacheHitCount > 0 && networkFetchCount > 0) {
      completionMessage += ` (${cacheHitCount} from cache, ${networkFetchCount} from network)`;
    } else if (cacheHitCount > 0) {
      completionMessage += ` (all from cache)`;
    }
    if (errorCount > 0) {
      completionMessage += ` (${errorCount} failed)`;
    }

    progress.currentPaper = completionMessage;
    onProgress?.(progress);

    return true;

  } catch (error) {
    console.error('Batch download failed:', error);

    const progress: BatchDownloadProgress = {
      totalPapers: papers.length,
      completed: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      percentage: 0
    };

    onProgress?.(progress);
    toast.error('Failed to create batch download');
    return false;
  }
} 