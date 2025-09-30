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

    // Initialize progress
    const progress: BatchDownloadProgress = {
      totalPapers: uniquePapers.length,
      completed: 0,
      status: 'preparing',
      percentage: 0
    };

    onProgress?.(progress);

    // Validate number of papers
    if (uniquePapers.length > 50) {
      const errorMsg = 'Maximum 50 papers can be downloaded at once';
      toast.error(errorMsg);
      progress.status = 'error';
      progress.error = errorMsg;
      onProgress?.(progress);
      return false;
    }

    // Check cache for each paper
    const cacheManager = getCacheManager();
    const cachedPapers: Paper[] = [];
    const uncachedPapers: Paper[] = [];

    progress.status = 'preparing';
    progress.currentPaper = 'Checking cache for existing papers...';
    onProgress?.(progress);

    for (const paper of uniquePapers) {
      const cachedData = await cacheManager.getPdf(paper.url);
      if (cachedData) {
        cachedPapers.push(paper);
      } else {
        uncachedPapers.push(paper);
      }
    }

    const cacheHitCount = cachedPapers.length;
    const networkFetchCount = uncachedPapers.length;


    await new Promise(resolve => setTimeout(resolve, 400));
    progress.status = 'downloading';
    progress.percentage = 2;
    progress.completed = 0;
    onProgress?.({ ...progress });

    try {
      const responsePromise = fetch('/api/download/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          papers: uncachedPapers, // Only fetch papers not in cache
          filters,
          cacheInfo: {
            totalPapers: uniquePapers.length,
            cachedCount: cacheHitCount,
            networkCount: networkFetchCount
          }
        }),
      });

      progress.status = 'downloading';
      progress.percentage = 5;
      
      if (cacheHitCount > 0 && networkFetchCount > 0) {
        progress.currentPaper = `Using ${cacheHitCount} cached papers, fetching ${networkFetchCount} more...`;
      } else if (cacheHitCount > 0) {
        progress.currentPaper = 'All papers found in cache...';
      } else {
        progress.currentPaper = `Fetching ${networkFetchCount} papers...`;
      }
      
      onProgress?.({ ...progress });

      const fastDownloadSteps = 8;
      const totalPapers = uniquePapers.length;

      // Account for cached papers in progress - they're "instantly" available
      const baseCompleted = cacheHitCount;

      for (let i = 0; i < fastDownloadSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));

        const networkProgress = Math.min(networkFetchCount, (i + 1) * Math.ceil(networkFetchCount / fastDownloadSteps));
        const newCompleted = baseCompleted + networkProgress;
        progress.completed = newCompleted;
        progress.percentage = 5 + Math.round((newCompleted / totalPapers) * 35);
        onProgress?.({ ...progress });

        if (i < fastDownloadSteps / 2) {
          if (cacheHitCount > 0 && networkFetchCount > 0) {
            const networkDownloaded = newCompleted - baseCompleted;
            progress.currentPaper = `Downloaded ${networkDownloaded}/${networkFetchCount} new papers (${cacheHitCount} from cache)`;
          } else {
            progress.currentPaper = `Collecting files (${progress.completed} of ${totalPapers})...`;
          }
        } else {
          progress.currentPaper = `Preparing batch (${progress.completed} of ${totalPapers})...`;
        }
      }

      progress.percentage = 40;
      progress.currentPaper = networkFetchCount > 0
        ? 'Waiting for server to process files...'
        : 'Processing cached files...';
      onProgress?.({ ...progress });

      const response = await responsePromise;

      if (!response.ok) {
        let errorMessage = 'Failed to create batch download';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
        }
        throw new Error(errorMessage);
      }

      const networkSuccessCount = parseInt(response.headers.get('X-Download-Success-Count') || '0');
      const networkErrorCount = parseInt(response.headers.get('X-Download-Error-Count') || '0');

      const totalSuccessCount = networkSuccessCount + cacheHitCount;
      const totalErrorCount = networkErrorCount;

      const blobPromise = response.blob();

      progress.completed = uniquePapers.length;
      progress.status = 'processing';
      progress.percentage = 50;
      progress.currentPaper = `Creating ZIP file with ${totalSuccessCount} papers`;
      if (cacheHitCount > 0) {
        progress.currentPaper += ` (${cacheHitCount} from cache)`;
      }
      if (totalErrorCount > 0) {
        progress.currentPaper += ` (${totalErrorCount} failed)`;
      }
      onProgress?.({ ...progress });

      const zipCreationTime = Math.min(2000, Math.max(800, papers.length * 40));
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

      const blob = await blobPromise;
      clearInterval(zipUpdateInterval);

      const actualZipTime = Date.now() - zipStartTime;
      if (actualZipTime < zipCreationTime) {
        const remainingTime = zipCreationTime - actualZipTime;
        progress.percentage = 80;
        onProgress?.({ ...progress });
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      progress.status = 'sending';
      progress.percentage = 90;
      progress.currentPaper = 'Preparing download...';
      onProgress?.({ ...progress });

      const objectUrl = URL.createObjectURL(blob);

      // Get filename from header if available
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'MITAoE_Papers.zip';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      await new Promise(resolve => setTimeout(resolve, 400));

      progress.percentage = 95;
      progress.currentPaper = 'Starting download...';
      onProgress?.({ ...progress });

      // Create download link
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      // Complete the progress
      progress.status = 'complete';
      progress.percentage = 100;

      let completionMessage = `Downloaded ${totalSuccessCount} papers successfully`;
      if (cacheHitCount > 0 && networkSuccessCount > 0) {
        completionMessage += ` (${cacheHitCount} from cache, ${networkSuccessCount} from network)`;
      } else if (cacheHitCount > 0) {
        completionMessage += ` (all from cache)`;
      }
      if (totalErrorCount > 0) {
        completionMessage += ` (${totalErrorCount} failed)`;
      }

      progress.currentPaper = completionMessage;
      onProgress?.({ ...progress });

      return true;
    } catch (fetchError) {
      console.error('Batch download request failed:', fetchError);

      progress.status = 'error';
      progress.error = fetchError instanceof Error
        ? fetchError.message
        : 'Failed to connect to download service';
      progress.percentage = 0;

      onProgress?.(progress);
      return false;
    }
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
    return false;
  }
} 