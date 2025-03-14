import { NextRequest, NextResponse } from 'next/server';
import mime from 'mime-types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Fetch the file from the original URL
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/pdf, application/octet-stream',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from source URL: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the filename from the URL or Content-Disposition header
    let fileName = '';
    const contentDisposition = response.headers.get('content-disposition');
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+?)"|filename=([^;]+)/);
      if (match) {
        fileName = match[1] || match[2] || '';
      }
    }
    
    if (!fileName) {
      // Try to extract filename from URL path
      const urlPath = new URL(url).pathname;
      const pathSegments = urlPath.split('/');
      fileName = pathSegments[pathSegments.length - 1];
    }
    
    // Clean up the filename
    fileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    
    // If we still don't have a filename, use a default
    if (!fileName || fileName === '') {
      fileName = `download_${Date.now()}.pdf`;
    }
    
    // Ensure PDF extension for relevant content types
    if (response.headers.get('content-type')?.includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
      fileName += '.pdf';
    }
    
    // Determine content type using mime-types package
    const fileExt = fileName.split('.').pop() || '';
    const contentType = mime.lookup(fileExt) || response.headers.get('content-type') || 'application/octet-stream';
    
    // Get the file content
    const blob = await response.blob();
    
    // Return the file with proper headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (error) {
    console.error('Proxy fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to proxy the file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 