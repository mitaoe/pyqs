import { toast } from 'sonner';

export async function downloadFile(url: string, fileName: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/pdf'
      }
    });
    
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