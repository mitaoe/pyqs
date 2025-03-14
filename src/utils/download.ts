import { toast } from 'sonner';
import { Paper } from '@/types/paper';

export async function downloadFile(url: string, fileName: string): Promise<boolean> {
  try {
    const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const contentDisposition = response.headers.get('content-disposition');
    const serverFileName = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/["']/g, '')
      : null;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = serverFileName || fileName;
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

    // Initialize progress
    const progress: BatchDownloadProgress = {
      totalPapers: papers.length,
      completed: 0,
      status: 'preparing',
      percentage: 0
    };
    
    onProgress?.(progress);

    // Validate number of papers
    if (papers.length > 50) {
      const errorMsg = 'Maximum 50 papers can be downloaded at once';
      toast.error(errorMsg);
      progress.status = 'error';
      progress.error = errorMsg;
      onProgress?.(progress);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    progress.status = 'downloading';
    progress.percentage = 2;
    progress.completed = 0;
    onProgress?.({...progress});

    try {
      const responsePromise = fetch('/api/download/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          papers,
          filters
        }),
      });
      
      progress.status = 'downloading';
      progress.percentage = 5;
      progress.currentPaper = 'Initiating batch download...';
      onProgress?.({...progress});
      
      const fastDownloadSteps = 8;
      const paperIncrement = Math.ceil(papers.length / fastDownloadSteps);
      
      for (let i = 0; i < fastDownloadSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
        
        const newCompleted = Math.min(papers.length, (i + 1) * paperIncrement);
        progress.completed = newCompleted;
        progress.percentage = 5 + Math.round((newCompleted / papers.length) * 35);
        onProgress?.({...progress});
        
        if (i < fastDownloadSteps / 2) {
          progress.currentPaper = `Collecting files (${progress.completed} of ${papers.length})...`;
        } else {
          progress.currentPaper = `Preparing batch (${progress.completed} of ${papers.length})...`;
        }
      }
      
      progress.percentage = 40;
      progress.currentPaper = 'Waiting for server to process files...';
      onProgress?.({...progress});
      
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
      
      const successCount = parseInt(response.headers.get('X-Download-Success-Count') || '0');
      const errorCount = parseInt(response.headers.get('X-Download-Error-Count') || '0');
      
      const blobPromise = response.blob();
      
      progress.completed = papers.length;
      progress.status = 'processing';
      progress.percentage = 50;
      progress.currentPaper = `Creating ZIP file with ${successCount} papers`;
      if (errorCount > 0) {
        progress.currentPaper += ` (${errorCount} failed)`;
      }
      onProgress?.({...progress});
      
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
        onProgress?.({...progress});
      }, 120);
      
      const blob = await blobPromise;
      clearInterval(zipUpdateInterval);
      
      const actualZipTime = Date.now() - zipStartTime;
      if (actualZipTime < zipCreationTime) {
        const remainingTime = zipCreationTime - actualZipTime;
        progress.percentage = 80;
        onProgress?.({...progress});
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      progress.status = 'sending';
      progress.percentage = 90;
      progress.currentPaper = 'Preparing download...';
      onProgress?.({...progress});
      
      const objectUrl = URL.createObjectURL(blob);
      
      // Get filename from header if available
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'MITAOE_Papers.zip';
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      progress.percentage = 95;
      progress.currentPaper = 'Starting download...';
      onProgress?.({...progress});
      
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
      progress.currentPaper = errorCount > 0 
        ? `Downloaded ${successCount} papers (${errorCount} failed)` 
        : `All ${successCount} papers downloaded successfully`;
      onProgress?.({...progress});
      
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