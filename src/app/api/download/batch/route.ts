import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { Paper } from '@/types/paper';
import mime from 'mime-types';

// Utility to trim redundant URL paths
const trimRedundantUrlPath = (url: string): string => {
  try {
    const urlParts = url.split('/');
    const uniqueParts = urlParts.filter((part, index, arr) => 
      index === arr.indexOf(part)
    );
    return uniqueParts.join('/');
  } catch (error) {
    console.error('URL trimming failed:', error);
    return url;
  }
};

async function fetchPaperContent(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/pdf, application/octet-stream',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}, status: ${response.status}`);
      return null;
    }

    // Convert to ArrayBuffer instead of Blob for better JSZip compatibility
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

// Format filename for ZIP - replace spaces with underscores and include filters
function formatZipFilename(papers: Paper[], filters: Record<string, string[]>): string {
  const subject = papers[0]?.standardSubject || papers[0]?.subject || '';
  const sanitizedSubject = subject.replace(/\s+/g, '_');
  
  let filename = sanitizedSubject ? `${sanitizedSubject}_Papers` : 'MITAOE_Papers';
  
  // Add filters to filename if they exist
  if (filters.years?.length) {
    filename += `_${filters.years.join('-')}`;
  }
  
  if (filters.examTypes?.length) {
    filename += `_${filters.examTypes.join('-')}`;
  }
  
  return `${filename}.zip`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the array of papers to download
    const body = await request.json();
    const papers: Paper[] = body.papers;
    const filters: Record<string, string[]> = body.filters || {};

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty papers array provided' },
        { status: 400 }
      );
    }

    // Limit the number of papers that can be downloaded at once
    if (papers.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 papers can be downloaded at once' },
        { status: 400 }
      );
    }

    // Create a new zip archive
    const zip = new JSZip();
    
    // Keep track of filenames to avoid duplicates
    const filenameMap = new Map<string, number>();
    
    // Fetch and add each paper to the zip
    let successCount = 0;
    let errorCount = 0;
    
    // Process papers sequentially to better track progress and avoid overwhelming the server
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      try {
        // Trim URL if needed
        const trimmedUrl = trimRedundantUrlPath(paper.url);
        
        // Fetch the paper content
        const arrayBuffer = await fetchPaperContent(trimmedUrl);
        
        if (!arrayBuffer) {
          errorCount++;
          continue;
        }
        
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
        
        // Add the file to the zip using ArrayBuffer
        zip.file(fileName, arrayBuffer);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error processing ${paper.fileName}:`, error);
      }
    }
    
    if (successCount === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch any of the requested papers',
          details: errorCount > 0 ? `${errorCount} papers failed to download` : undefined
        },
        { status: 500 }
      );
    }
    
    // Generate the zip file - use best compression settings for high quality
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { 
        level: 9  // Maximum compression level (0-9)
      }
    });
    
    // Create a filename for the zip based on the selected subject and filters
    const zipFileName = formatZipFilename(papers, filters);
    
    // Set content type using mime-types
    const contentType = mime.lookup('zip') || 'application/zip';
    
    // Add metadata about the download
    const responseHeaders = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${zipFileName}"`,
      'Cache-Control': 'no-store',
      'X-Download-Success-Count': successCount.toString(),
      'X-Download-Error-Count': errorCount.toString(),
      'X-Download-Total-Count': papers.length.toString(),
    };
    
    // Return the zip file with metadata
    return new NextResponse(zipBlob, { headers: responseHeaders });
    
  } catch (error) {
    console.error('Batch download error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create batch download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 