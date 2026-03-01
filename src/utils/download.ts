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
  // Phase-specific data for segmented progress
  cachedCount?: number;
  networkCount?: number;
  currentPhase?: 'cache' | 'network' | 'zip' | 'send';
  failedCount?: number;
}

export type ProgressCallback = (progress: BatchDownloadProgress) => void;

// Format filename for ZIP - replace spaces with underscores and include filters
function formatZipFilename(papers: Paper[], filters: Record<string, string[]>): string {
  if (!papers || papers.length === 0) {
    return 'MITAoE_Papers.zip';
  }

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
    const seenUrls = new Set<string>();
    const uniquePapers = papers.filter(paper => {
      if (seenUrls.has(paper.url)) {
        return false;
      }
      seenUrls.add(paper.url);
      return true;
    });

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
      onProgress?.({ ...progress });
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
      percentage: 0,
      cachedCount: 0,
      networkCount: 0,
      failedCount: 0,
      currentPhase: 'cache'
    };

    onProgress?.({ ...progress });

    // Check cache for each paper first
    const cachedPapers: Paper[] = [];
    const uncachedPapers: Paper[] = [];

    progress.status = 'preparing';
    progress.currentPaper = 'Checking cache for existing papers...';
    onProgress?.({ ...progress });

    // Check cache with progress updates to prevent UI blocking
    for (let i = 0; i < uniquePapers.length; i++) {
      const paper = uniquePapers[i];

      // Update progress during cache checking
      if (i % 5 === 0 || i === uniquePapers.length - 1) {
        progress.percentage = Math.round((i / uniquePapers.length) * 2); // 0-2%
        progress.currentPaper = `Checking cache... (${i + 1}/${uniquePapers.length})`;
        onProgress?.({ ...progress });

        // Small delay to let UI update
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const cachedData = await cacheManager.getPdf(paper.url);
      if (cachedData) {
        cachedPapers.push(paper);
      } else {
        uncachedPapers.push(paper);
      }
    }

    const cacheHitCount = cachedPapers.length;
    const networkFetchCount = uncachedPapers.length;

    // Update progress with cache/network split
    progress.cachedCount = cacheHitCount;
    progress.networkCount = networkFetchCount;

    // Transition to downloading phase
    await new Promise(resolve => setTimeout(resolve, 400));
    progress.status = 'downloading';
    progress.percentage = 5;
    progress.completed = 0;
    progress.currentPhase = cacheHitCount > 0 ? 'cache' : 'network';

    if (cacheHitCount > 0 && networkFetchCount > 0) {
      progress.currentPaper = `${cacheHitCount} cached • ${networkFetchCount} to download`;
    } else if (cacheHitCount > 0) {
      progress.currentPaper = `${cacheHitCount} papers from cache`;
    } else {
      progress.currentPaper = `${networkFetchCount} papers to download`;
    }

    onProgress?.({ ...progress });

    let successCount = 0;
    let errorCount = 0;

    // Process cached papers first (instant)
    for (let i = 0; i < cachedPapers.length; i++) {
      const paper = cachedPapers[i];
      try {
        // Update progress for cached papers
        progress.completed = i + 1;
        progress.percentage = 5 + Math.round((progress.completed / uniquePapers.length) * 80);
        progress.currentPhase = 'cache';
        progress.currentPaper = `${i + 1}/${cachedPapers.length} from cache`;
        onProgress?.({ ...progress });

        const pdfData = await cacheManager.getPdf(paper.url);
        if (pdfData) {
          let fileName = paper.fileName;
          if (!fileName.toLowerCase().endsWith('.pdf')) {
            fileName += '.pdf';
          }

          zip.file(fileName, pdfData);
          successCount++;
        }
        
        // Small delay for smooth animation
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error processing cached ${paper.fileName}:`, error);
        errorCount++;
        progress.failedCount = errorCount;
      }
    }

    // Process uncached papers
    for (let i = 0; i < uncachedPapers.length; i++) {
      const paper = uncachedPapers[i];
      try {
        // Update progress for uncached papers
        progress.completed = cachedPapers.length + i + 1;
        progress.percentage = 5 + Math.round((progress.completed / uniquePapers.length) * 80);
        progress.currentPhase = 'network';
        progress.currentPaper = `${i + 1}/${uncachedPapers.length} downloading`;
        onProgress?.({ ...progress });

        const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(paper.url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          console.error(`Failed to fetch ${paper.url}, status: ${response.status}`);
          errorCount++;
          continue;
        }

        const pdfData = await response.arrayBuffer();

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
        }

        // Add to ZIP
        let fileName = paper.fileName;
        if (!fileName.toLowerCase().endsWith('.pdf')) {
          fileName += '.pdf';
        }

        zip.file(fileName, pdfData);
        successCount++;

      } catch (error) {
        console.error(`Error processing ${paper.fileName}:`, error);
        errorCount++;
        progress.failedCount = errorCount;
      }
    }

    if (successCount === 0) {
      const errorMsg = 'Failed to fetch any of the requested papers';
      progress.status = 'error';
      progress.error = errorMsg;
      progress.percentage = 0;
      onProgress?.({ ...progress });
      return false;
    }

    // ZIP creation phase
    progress.completed = uniquePapers.length;
    progress.status = 'processing';
    progress.percentage = 85;
    progress.currentPhase = 'zip';
    progress.currentPaper = `Compressing ${successCount} papers`;
    progress.failedCount = errorCount;
    onProgress?.({ ...progress });

    // Simulate ZIP creation time with smooth progress
    const zipCreationTime = Math.min(1500, Math.max(600, uniquePapers.length * 30));
    const zipStartTime = Date.now();

    const zipUpdateInterval = setInterval(() => {
      const elapsed = Date.now() - zipStartTime;
      if (elapsed >= zipCreationTime) {
        clearInterval(zipUpdateInterval);
        return;
      }

      const progressPercent = 85 + Math.min(8, Math.round((elapsed / zipCreationTime) * 8));
      progress.percentage = progressPercent;
      onProgress?.({ ...progress });
    }, 120);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      }
    });

    clearInterval(zipUpdateInterval);

    // Ensure minimum time for smooth UX
    const actualZipTime = Date.now() - zipStartTime;
    if (actualZipTime < zipCreationTime) {
      const remainingTime = zipCreationTime - actualZipTime;
      progress.percentage = 93;
      onProgress?.({ ...progress });
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // Sending phase
    progress.status = 'sending';
    progress.percentage = 95;
    progress.currentPhase = 'send';
    progress.currentPaper = 'Preparing download';
    onProgress?.({ ...progress });

    const zipFileName = formatZipFilename(uniquePapers, filters);
    const objectUrl = URL.createObjectURL(zipBlob);

    await new Promise(resolve => setTimeout(resolve, 300));

    progress.percentage = 98;
    progress.currentPaper = 'Starting download';
    onProgress?.({ ...progress });

    // Create download link
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    progress.status = 'complete';
    progress.percentage = 100;
    progress.currentPhase = 'send';

    let completionMessage = `${successCount} papers downloaded`;
    if (errorCount > 0) {
      completionMessage += ` • ${errorCount} failed`;
    }

    progress.currentPaper = completionMessage;
    onProgress?.({ ...progress });

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

    onProgress?.({ ...progress });
    toast.error('Failed to create batch download');
    return false;
  }
} 