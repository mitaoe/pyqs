import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import PYQ from '@/models/Paper';
import type { SavedDocument } from '@/types/paper';

async function getPapersData() {
  await dbConnect();
  const doc = await PYQ.findOne().sort({ lastUpdated: -1 }).lean() as SavedDocument | null;
  return doc;
}

// Single-entry cache for the papers document
let cachedDoc: SavedDocument | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedPapersData(): Promise<SavedDocument | null> {
  // Check if cache is still valid
  if (cachedDoc && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return cachedDoc;
  }

  // Fetch fresh data and cache it
  const doc = await getPapersData();
  cachedDoc = doc;
  cacheTimestamp = Date.now();
  
  return doc;
}

export async function GET(request: Request) {
  try {
    // Get cached papers document
    const doc = await getCachedPapersData();

    if (!doc) {
      console.warn('No paper data found in database');
      return NextResponse.json(
        { error: 'No paper data found' },
        { status: 404 }
      );
    }

    // Return all papers
    const responseData = {
      meta: {
        ...doc.meta,
        papers: doc.papers
      },
      lastUpdated: doc.stats.lastUpdated,
      stats: doc.stats
    };

    // Generate ETag based on last updated time
    const etag = `"${crypto.createHash('md5').update(doc.stats.lastUpdated.toString()).digest('hex')}"`;

    // Check If-None-Match header for conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=604800, s-maxage=2592000', // 1 week browser, 1 month edge
          'CDN-Cache-Control': 'max-age=2592000', // 1 month Vercel edge
        }
      });
    }

    return NextResponse.json(responseData, {
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000', // 1 week browser, 1 month edge
        'CDN-Cache-Control': 'max-age=2592000', // 1 month Vercel edge
        'Vary': 'Accept-Encoding',
      }
    });

  } catch (error) {
    console.error('Failed to fetch papers:', error);

    // Handle specific MongoDB errors
    if (error instanceof Error) {
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        return NextResponse.json(
          {
            error: 'Database connection error',
            details: error.message
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch papers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}