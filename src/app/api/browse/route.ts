import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Paper from '@/models/Paper';
import Directory from '@/models/Directory';
import type { BrowseResponse, Paper as PaperType } from '@/types/paper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currentPath = searchParams.get('path') || '';

  console.log('Browse request for path:', currentPath);

  try {
    await dbConnect();
    console.log('Connected to MongoDB');

    // Get current directory
    const currentDir = currentPath ? 
      await Directory.findOne({ path: currentPath }).populate('papers') :
      null;

    // Get subdirectories
    const subdirs = await Directory.find({ 
      parent: currentPath || null 
    }).sort({ name: 1 });

    console.log(`Found ${subdirs.length} subdirectories`);

    // Get papers in current directory
    const papers = (currentDir?.papers || []) as PaperType[];
    console.log(`Found ${papers.length} papers`);

    const response: BrowseResponse = {
      currentPath,
      directories: subdirs.map(dir => dir.name),
      papers: papers.map(paper => ({
        name: paper.fileName,
        downloadUrl: paper.downloadUrl,
        year: paper.year,
        branch: paper.branch,
        semester: paper.semester,
        examType: paper.examType
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to browse papers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to browse papers',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 