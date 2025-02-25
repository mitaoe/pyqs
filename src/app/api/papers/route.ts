import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PYQ from '@/models/Paper';
import type { SavedDocument } from '@/types/paper';

export async function GET() {
  try {
    await dbConnect();

    const doc = await PYQ.findOne().sort({ lastUpdated: -1 }).lean() as SavedDocument | null;
    
    if (!doc) {
      console.warn('No paper data found in database');
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