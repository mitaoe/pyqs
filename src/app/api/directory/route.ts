import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Directory from '@/models/Directory';
import type { DirectoryDocument } from '@/types/paper';

export async function GET() {
  try {
    await dbConnect();

    const doc = await Directory.findOne().sort({ lastUpdated: -1 }).lean() as DirectoryDocument | null;
    
    if (!doc) {
      console.warn('No directory structure found in database');
      return NextResponse.json(
        { error: 'No directory structure found' },
        { status: 404 }
      );
    }

    // Ensure the structure has the correct format
    const structure = doc.structure;
    if (!structure || !structure.children || typeof structure.children !== 'object') {
      console.error('Invalid directory structure:', structure);
      return NextResponse.json(
        { error: 'Invalid directory structure' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      structure,
      meta: doc.meta,
      stats: doc.stats,
      lastUpdated: doc.lastUpdated
    });

  } catch (error) {
    console.error('Failed to fetch directory structure:', error);
    
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
        error: 'Failed to fetch directory structure',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 