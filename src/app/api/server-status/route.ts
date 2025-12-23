import { NextResponse } from 'next/server';

const MITAOE_LIBRARY_URL = 'http://43.227.20.36:82/DigitalLibrary/';
const TIMEOUT_MS = 2500; // 2.5 seconds timeout

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(MITAOE_LIBRARY_URL, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    const isAvailable = response.ok || response.status === 403; // 403 means server is up but blocking

    return NextResponse.json(
      {
        isAvailable,
        status: response.status,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Server status check failed:', error);
    
    return NextResponse.json(
      {
        isAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
