import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PYQ from '@/models/Paper';
import type { SavedDocument } from '@/types/paper';
import type { FilterQuery } from 'mongoose';

export async function GET(request: Request) {
  try {
    await dbConnect();

    // Get query parameters
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject');
    const year = url.searchParams.get('year');
    const branch = url.searchParams.get('branch');
    const semester = url.searchParams.get('semester');
    const examType = url.searchParams.get('examType');

    // Build query
    const query: FilterQuery<SavedDocument> = {};
    if (subject) {
      query.$or = [
        { 'papers.subject': subject },
        { 'papers.standardSubject': subject }
      ];
    }
    if (year) query['papers.year'] = year;
    if (branch) query['papers.branch'] = branch;
    if (semester) query['papers.semester'] = semester;
    if (examType) query['papers.examType'] = examType;

    const doc = await PYQ.findOne(query).sort({ lastUpdated: -1 }).lean() as SavedDocument | null;
    
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

    return NextResponse.json({
      meta,
      lastUpdated: doc.stats.lastUpdated,
      stats: doc.stats
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