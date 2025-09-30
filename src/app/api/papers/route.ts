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

// Request memoization for duplicate API calls within request lifecycle
const memoizedRequests = new Map<string, Promise<SavedDocument | null>>();

function getMemoizedRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (memoizedRequests.has(key)) {
    return memoizedRequests.get(key) as Promise<T>;
  }

  const promise = fn();
  memoizedRequests.set(key, promise as Promise<SavedDocument | null>);

  // Clean up after request completes
  promise.finally(() => {
    memoizedRequests.delete(key);
  });

  return promise;
}

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject');
    const year = url.searchParams.get('year');
    const branch = url.searchParams.get('branch');
    const semester = url.searchParams.get('semester');
    const examType = url.searchParams.get('examType');

    // Create cache key for memoization
    const queryParams = { subject, year, branch, semester, examType };
    const memoKey = `papers-${JSON.stringify(queryParams)}`;

    // Use request memoization for duplicate calls within request lifecycle
    const doc = await getMemoizedRequest(memoKey, () => getPapersData());

    if (!doc) {
      console.warn('No paper data found in database');
      return NextResponse.json(
        { error: 'No paper data found' },
        { status: 404 }
      );
    }

    // Filter papers based on query parameters
    let papers = doc.papers;
    if (subject) {
      papers = papers.filter(p =>
        p.subject === subject || p.standardSubject === subject
      );
    }
    if (year) {
      papers = papers.filter(p => p.year === year);
    }
    if (branch) {
      papers = papers.filter(p => p.branch === branch);
    }
    if (semester) {
      papers = papers.filter(p => p.semester === semester);
    }
    if (examType) {
      papers = papers.filter(p => p.examType === examType);
    }

    // Create meta object with papers included
    const meta = {
      ...doc.meta,
      papers: papers
    };

    const responseData = {
      meta,
      lastUpdated: doc.stats.lastUpdated,
      stats: doc.stats
    };

    // Generate ETag based on response data and last updated time
    const etag = `"${crypto.createHash('md5').update(JSON.stringify(responseData)).digest('hex')}"`;

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