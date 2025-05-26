import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const paperUrl = url.searchParams.get('url');

    if (!paperUrl) {
      return NextResponse.json(
        { error: 'Paper URL is required' },
        { status: 400 }
      );
    }

    // Fetch the paper content
    const response = await fetch(paperUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch paper content');
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/pdf';

    // Get the paper content as an array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Return the paper content with appropriate headers
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paper content' },
      { status: 500 }
    );
  }
} 