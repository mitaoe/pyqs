import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PYQ from '@/models/Paper';

export async function GET() {
  try {
    await dbConnect();

    const doc = await PYQ.findOne().sort({ lastUpdated: -1 }).lean();
    if (!doc) {
      return NextResponse.json(
        { error: 'No paper data found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      structure: doc.structure,
      meta: doc.meta,
      lastUpdated: doc.lastUpdated
    });

  } catch (error) {
    console.error('Failed to fetch papers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch papers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 