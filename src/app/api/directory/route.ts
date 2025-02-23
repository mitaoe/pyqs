import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Paper from '@/models/Paper';

interface QueryParams {
  year?: string;
  branch?: string;
  semester?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const branch = searchParams.get('branch');
  const semester = searchParams.get('semester');

  try {
    await dbConnect();

    const query: QueryParams = {};
    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (semester) query.semester = semester;

    if (!year) {
      // Return list of years
      const years = await Paper.distinct('year');
      return NextResponse.json(years
        .filter(y => y !== 'Unknown')
        .sort((a, b) => b.localeCompare(a)) // Sort years in descending order
        .map(year => ({
          name: year,
          isDirectory: true,
          path: `/api/directory?year=${year}`
        }))
      );
    }

    if (!branch) {
      // Return list of branches for the year
      const branches = await Paper.distinct('branch', { year });
      return NextResponse.json(branches
        .filter(b => b !== 'Unknown')
        .sort()
        .map(branch => ({
          name: branch,
          isDirectory: true,
          path: `/api/directory?year=${year}&branch=${branch}`
        }))
      );
    }

    if (!semester) {
      // Return list of semesters for the year and branch
      const semesters = await Paper.distinct('semester', { year, branch });
      return NextResponse.json(semesters
        .filter(s => s !== 'Unknown')
        .sort((a, b) => {
          const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        })
        .map(semester => ({
          name: semester,
          isDirectory: true,
          path: `/api/directory?year=${year}&branch=${branch}&semester=${semester}`
        }))
      );
    }

    // Return list of papers
    const papers = await Paper.find(query).sort({ fileName: 1 });
    return NextResponse.json(papers.map(paper => ({
      name: paper.fileName,
      isDirectory: false,
      path: paper.originalUrl
    })));

  } catch (error) {
    console.error('Failed to fetch directory:', error);
    return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
  }
} 