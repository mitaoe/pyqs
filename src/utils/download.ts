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
      let fileIndex = 0;
      const updateInterval = setInterval(() => {
        if (progress.status !== 'downloading') {
          clearInterval(updateInterval);
          return;
        }
        
        // Only update every few papers for smoother UI and less updates
        fileIndex += Math.max(1, Math.floor(papers.length / 30));
        if (fileIndex > papers.length) {
          fileIndex = papers.length - 1;
        }
        
        progress.completed = fileIndex;
        // Calculate percentage: 2% start + up to 80% for downloads
        const downloadPercentage = Math.min(80, (fileIndex / papers.length) * 80);
        progress.percentage = 2 + downloadPercentage;
        onProgress?.({...progress});
        
        // If we've reached the end, stop updates
        if (fileIndex >= papers.length - 1) {
          clearInterval(updateInterval);
        }
      }, 250);
      
      const response = await fetch('/api/download/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          papers,
          filters
        }),
      });

      clearInterval(updateInterval);

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
      
      // Update progress with actual numbers from server
      progress.completed = successCount;
     
      // Update to processing phase (creating ZIP)
      progress.status = 'processing';
      progress.percentage = 90;
      progress.currentPaper = `Successfully processed ${successCount} of ${papers.length} papers`;
      onProgress?.({...progress});
      
      // Show processing state for a moment
      await new Promise(resolve => setTimeout(resolve, 400));

      const blob = await response.blob();
      
      // Update to sending phase (sending to browser)
      progress.status = 'sending';
      progress.percentage = 95;
      onProgress?.({...progress});
      
      // Small delay to show the "sending to browser" message
      await new Promise(resolve => setTimeout(resolve, 600));
      
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
      
      // Create download link
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      progress.completed = successCount;
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