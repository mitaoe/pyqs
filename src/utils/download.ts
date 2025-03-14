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
  status: 'preparing' | 'downloading' | 'processing' | 'complete' | 'error';
  error?: string;
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
      status: 'preparing'
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

    progress.status = 'downloading';
    onProgress?.(progress);

    try {
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

      if (!response.ok) {
        let errorMessage = 'Failed to create batch download';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
        }
        
        throw new Error(errorMessage);
      }

      progress.status = 'processing';
      onProgress?.(progress);

      const blob = await response.blob();
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
      
      progress.completed = papers.length;
      progress.status = 'complete';
      onProgress?.(progress);
      
      toast.success(`Downloaded ${papers.length} papers as ${fileName}`);
      return true;
    } catch (fetchError) {
      console.error('Batch download request failed:', fetchError);
      
      progress.status = 'error';
      progress.error = fetchError instanceof Error 
        ? fetchError.message 
        : 'Failed to connect to download service';
      
      onProgress?.(progress);
      toast.error(progress.error);
      return false;
    }
  } catch (error) {
    console.error('Batch download failed:', error);
    
    const progress: BatchDownloadProgress = {
      totalPapers: papers.length,
      completed: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    onProgress?.(progress);
    toast.error('Failed to download papers. Please try again.');
    return false;
  }
} 