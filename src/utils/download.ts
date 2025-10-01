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
      percentage: 0
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

    // Transition to downloading phase
    await new Promise(resolve => setTimeout(resolve, 400));
    progress.status = 'downloading';
    progress.percentage = 5;
    progress.completed = 0;

    if (cacheHitCount > 0 && networkFetchCount > 0) {
      progress.currentPaper = `Using ${cacheHitCount} cached papers, fetching ${networkFetchCount} more...`;
    } else if (cacheHitCount > 0) {
      progress.currentPaper = 'All papers found in cache...';
    } else {
      progress.currentPaper = `Fetching ${networkFetchCount} papers...`;
    }

    onProgress?.({ ...progress });

    // Progress simulation for downloading phase
    const downloadSteps = 8;
    const baseCompleted = cacheHitCount; // Cached papers are "instantly" available

    for (let i = 0; i < downloadSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));

      const networkProgress = Math.min(networkFetchCount, (i + 1) * Math.ceil(networkFetchCount / downloadSteps));
      const newCompleted = baseCompleted + networkProgress;
      progress.completed = newCompleted;
      progress.percentage = 5 + Math.round((newCompleted / uniquePapers.length) * 35);

      if (i < downloadSteps / 2) {
        if (cacheHitCount > 0 && networkFetchCount > 0) {
          const networkDownloaded = newCompleted - baseCompleted;
          progress.currentPaper = `Downloaded ${networkDownloaded}/${networkFetchCount} new papers (${cacheHitCount} from cache)`;
        } else {
          progress.currentPaper = `Collecting files (${progress.completed} of ${uniquePapers.length})...`;
        }
      } else {
        progress.currentPaper = `Preparing batch (${progress.completed} of ${uniquePapers.length})...`;
      }

      onProgress?.({ ...progress }); // Create new object for React re-render
    }

    // Actually fetch the papers now
    progress.percentage = 40;
    progress.currentPaper = networkFetchCount > 0
      ? 'Processing files...'
      : 'Processing cached files...';
    onProgress?.({ ...progress });

    let successCount = 0;
    let errorCount = 0;
    const filenameMap = new Map<string, number>();

    // Process cached papers first (instant)
    for (let i = 0; i < cachedPapers.length; i++) {
      const paper = cachedPapers[i];
      try {
        // Update progress for cached papers
        progress.percentage = 40 + Math.round((i / uniquePapers.length) * 10);
        progress.currentPaper = `Processing ${paper.fileName} (cached)...`;
        onProgress?.({ ...progress });

        const pdfData = await cacheManager.getPdf(paper.url);
        if (pdfData) {
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

          zip.file(fileName, pdfData);
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing cached ${paper.fileName}:`, error);
        errorCount++;
      }
    }

    // Process uncached papers
    for (let i = 0; i < uncachedPapers.length; i++) {
      const paper = uncachedPapers[i];
      try {
        // Update progress for uncached papers
        const overallProgress = cachedPapers.length + i;
        progress.percentage = 40 + Math.round((overallProgress / uniquePapers.length) * 10);
        progress.currentPaper = `Downloading ${paper.fileName}...`;
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

        if (filenameMap.has(fileName)) {
          const count = filenameMap.get(fileName)! + 1;
          filenameMap.set(fileName, count);
          const dotIndex = fileName.lastIndexOf('.');
          if (dotIndex !== -1) {
            const base = fileName.substring(0, dotIndex);
            const ext = fileName.substring(dotIndex + 1);
            fileName = `${base}_${count}.${ext}`;
          } else {
            fileName = `${fileName}_${count}`;
          }
        } else {
          filenameMap.set(fileName, 1);
        }

        zip.file(fileName, pdfData);
        successCount++;

      } catch (error) {
        console.error(`Error processing ${paper.fileName}:`, error);
        errorCount++;
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
    progress.percentage = 50;
    progress.currentPaper = `Creating ZIP file with ${successCount} papers`;
    if (cacheHitCount > 0) {
      progress.currentPaper += ` (${cacheHitCount} from cache)`;
    }
    if (errorCount > 0) {
      progress.currentPaper += ` (${errorCount} failed)`;
    }
    onProgress?.({ ...progress });

    // Simulate ZIP creation time with smooth progress
    const zipCreationTime = Math.min(2000, Math.max(800, uniquePapers.length * 40));
    const zipStartTime = Date.now();

    const zipUpdateInterval = setInterval(() => {
      const elapsed = Date.now() - zipStartTime;
      if (elapsed >= zipCreationTime) {
        clearInterval(zipUpdateInterval);
        return;
      }

      const progressPercent = 50 + Math.min(30, Math.round((elapsed / zipCreationTime) * 30));
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
      progress.percentage = 80;
      onProgress?.({ ...progress });
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // Sending phase
    progress.status = 'sending';
    progress.percentage = 90;
    progress.currentPaper = 'Preparing download...';
    onProgress?.({ ...progress });

    const zipFileName = formatZipFilename(uniquePapers, filters);
    const objectUrl = URL.createObjectURL(zipBlob);

    await new Promise(resolve => setTimeout(resolve, 400));

    progress.percentage = 95;
    progress.currentPaper = 'Starting download...';
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