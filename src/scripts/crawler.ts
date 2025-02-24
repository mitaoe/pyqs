import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { branchMappings, yearMappings, examMappings, semesterMappings, subjectBranchMappings } from '@/config/mappings';

const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL = 'http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/';

// Directory schema
interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: Record<string, DirectoryNode>;
  parent?: DirectoryNode;
  metadata?: {
    year?: string;
    branch?: string;
    examType?: string;
    semester?: string;
    url?: string;
  };
  stats: {
    totalFiles: number;
    totalDirectories: number;
  };
}

// Single document schema
const PYQSchema = new mongoose.Schema({
  lastUpdated: Date,
  stats: {
    totalFiles: Number,
    totalDirectories: Number
  },
  structure: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  meta: {
    years: [String],
    branches: [String],
    examTypes: [String],
    semesters: [String]
  }
});

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PYQSchema);

// Global state for building our document
let pyqDocument = {
  lastUpdated: new Date(),
  stats: {
    totalFiles: 0,
    totalDirectories: 0
  },
  structure: {} as DirectoryNode,
  meta: {
    years: new Set<string>(),
    branches: new Set<string>(),
    examTypes: new Set<string>(),
    semesters: new Set<string>()
  }
};

interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

function getPathParts(path: string): string[] {
  const parts = path.split('/Old Question Papers/B Tech (Autonomy)/')[1]?.split('/') || [];
  return parts.filter(part => part.length > 0).map(cleanName);
}

async function fetchDirectory(path: string): Promise<DirectoryItem[]> {
  console.log('\nFetching directory:', path);
  try {
    const response = await fetch(path, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.status}`);
    }

    const html = await response.text();
    const items = parseDirectoryListing(html, path);
    console.log(`Found ${items.length} items in ${path}`);
    return items;
  } catch (error) {
    console.error(`Failed to fetch directory ${path}:`, error);
    return [];
  }
}

function parseDirectoryListing(html: string, currentPath: string): DirectoryItem[] {
  const items: DirectoryItem[] = [];
  const $ = cheerio.load(html);

  $('a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');
    const name = $link.text().trim();

    if (name === '[To Parent Directory]' || !href) {
      return;
    }

    if (href.endsWith('/')) {
      items.push({
        name: cleanName(name),
        isDirectory: true,
        path: new URL(href, currentPath).href
      });
    } else if (href.endsWith('.pdf')) {
      items.push({
        name,
        isDirectory: false,
        path: new URL(href, currentPath).href
      });
    }
  });

  return items;
}

function extractYear(path: string, fileName: string): string {
  // First try to extract year from the path
  const pathYearMatch = path.match(/\/2\s*0\s*(\d\s*\d)/);
  if (pathYearMatch) {
    const year = pathYearMatch[0].replace(/\s+/g, '').slice(1); // Remove leading slash and spaces
    if (year >= '2000' && year <= '2025') {
      return year;
    }
  }

  // Then try to extract year from the filename
  const fileYearMatch = fileName.match(/20\d{2}/);
  if (fileYearMatch) {
    const year = fileYearMatch[0];
    if (year >= '2000' && year <= '2025') {
      return year;
    }
  }

  // Check for academic year patterns
  const academicYearMatch = fileName.match(/^[SF]\.?Y\.?|FIRST[\s_-]YEAR|SECOND[\s_-]YEAR/i);
  if (academicYearMatch) {
    const match = academicYearMatch[0].toUpperCase();
    const mappedYear = yearMappings[match];
    if (mappedYear) {
      return mappedYear;
    }
  }

  return 'Unknown';
}

function extractBranch(path: string, fileName: string): string {
  const pathParts = path.split('/').map(p => p.trim());
  const branchPattern = Object.keys(branchMappings).join('|');
  const branchRegexes = [
    new RegExp(`(?:^|[_\\s-])(${branchPattern})(?:[_\\s-]|$)`, 'i'),
    new RegExp(`(?:^|[_\\s-])([A-Z]+)(?:[_\\s-]|$)`, 'i')
  ];
  
  let branch = 'Unknown';

  // First try exact matches from mappings
  for (const regex of branchRegexes) {
    // Check in filename
    const fileMatch = fileName.match(regex);
    if (fileMatch && branchMappings[fileMatch[1].toUpperCase()]) {
      branch = branchMappings[fileMatch[1].toUpperCase()];
      break;
    }

    // Check in path parts
    for (const part of pathParts) {
      const pathMatch = part.match(regex);
      if (pathMatch && branchMappings[pathMatch[1].toUpperCase()]) {
        branch = branchMappings[pathMatch[1].toUpperCase()];
        break;
      }
    }

    if (branch !== 'Unknown') break;
  }

  // If no branch found, try to extract from subject name
  if (branch === 'Unknown') {
    const upperFileName = fileName.toUpperCase();
    for (const [subject, mappedBranch] of Object.entries(subjectBranchMappings)) {
      if (upperFileName.includes(subject)) {
        branch = mappedBranch;
        break;
      }
    }
  }

  // Handle multiple branches (e.g., MECH-CIVIL-CHEM)
  if (branch === 'Unknown') {
    const multiplePattern = /(MECH|CIVIL|CHEM|COMP|IT|ENTC|ETX)[-_\s]+(MECH|CIVIL|CHEM|COMP|IT|ENTC|ETX)/i;
    const multiMatch = fileName.match(multiplePattern) || 
                      pathParts.find(p => multiplePattern.test(p))?.match(multiplePattern);
    if (multiMatch) {
      const firstBranch = multiMatch[1].toUpperCase();
      if (branchMappings[firstBranch]) {
        branch = branchMappings[firstBranch];
      }
    }
  }

  return branch;
}

/**
 * Sanitizes a key for use in Mongoose maps by replacing dots with underscores
 */
function sanitizeKey(key: string): string {
  return key.replace(/\./g, '_');
}

function addToStructure(path: string, item: DirectoryItem, metadata?: { year?: string; branch?: string; examType?: string; semester?: string; }) {
  const parts = getPathParts(item.path);
  let current = pyqDocument.structure;
  
  // Initialize root if needed
  if (!current.name) {
    current.name = 'root';
    current.path = BASE_URL;
    current.type = 'directory';
    current.children = {};
    current.stats = { totalFiles: 0, totalDirectories: 0 };
  }

  // Build the path
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const fullPath = BASE_URL + parts.slice(0, i + 1).join('/');

    if (!current.children) {
      current.children = {};
    }

    if (!current.children[part]) {
      current.children[part] = {
        name: part,
        path: fullPath,
        type: isLast && !item.isDirectory ? 'file' : 'directory',
        parent: current,
        stats: { totalFiles: 0, totalDirectories: 0 }
      };

      if (isLast && !item.isDirectory) {
        current.children[part].metadata = {
          ...metadata,
          url: item.path
        };
        // Update stats
        let temp: DirectoryNode | undefined = current;
        while (temp) {
          temp.stats.totalFiles++;
          temp = temp.parent;
        }
        pyqDocument.stats.totalFiles++;
      } else {
        current.children[part].children = {};
        // Update directory stats
        let temp: DirectoryNode | undefined = current;
        while (temp) {
          temp.stats.totalDirectories++;
          temp = temp.parent;
        }
        pyqDocument.stats.totalDirectories++;
      }
    }

    current = current.children[part];
  }

  // Update metadata sets if available
  if (metadata) {
    if (metadata.year) pyqDocument.meta.years.add(metadata.year);
    if (metadata.branch) pyqDocument.meta.branches.add(metadata.branch);
    if (metadata.examType) pyqDocument.meta.examTypes.add(metadata.examType);
    if (metadata.semester) pyqDocument.meta.semesters.add(metadata.semester);
  }
}

function extractMetadata(path: string, fileName: string) {
  try {
    if (!path || !fileName) {
      console.log('Missing path or filename:', { path, fileName });
      return {
        year: 'Unknown',
        semester: 'Unknown',
        branch: 'Unknown',
        examType: 'Unknown'
      };
    }
    
    console.log('\nProcessing file:', { fileName, path });
    const pathParts = path.split('/').map(p => p.trim());
    
    // Extract year using the new function
    const year = extractYear(path, fileName);
    
    // Extract semester - more flexible pattern
    const semMatch = fileName.match(/SEM[ester]*[\s-]*([IVX\d]+)/i) ||
                    fileName.match(/Semester[\s-]*([IVX\d]+)/i) ||
                    pathParts.find(p => /SEM[ester]*[\s-]*([IVX\d]+)/i.test(p))?.match(/SEM[ester]*[\s-]*([IVX\d]+)/i);
    const rawSemester = semMatch?.[1]?.toUpperCase() || 'Unknown';
    const semester = semesterMappings[rawSemester] || 'Unknown';

    // Extract branch using the new function
    const branch = extractBranch(path, fileName);

    // Extract exam type - check both direct matches and month-based
    const examPattern = Object.keys(examMappings).join('|');
    const examRegex = new RegExp(`(?:^|[_\\s-])(${examPattern}|END COURSE|UNIT TEST|CYCLE)(?:[_\\s-]|$)`, 'i');
    const examMatch = fileName.match(examRegex) ||
                     pathParts.find(p => examRegex.test(p))?.match(examRegex);
    
    // If no direct exam type match, try to extract from month
    const monthRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;
    const monthMatch = fileName.match(monthRegex) ||
                      pathParts.find(p => monthRegex.test(p))?.match(monthRegex);
    
    let examType = 'Unknown';
    if (examMatch) {
      const matchedExam = examMatch[1].toUpperCase();
      if (matchedExam === 'END COURSE') examType = 'ESE';
      else if (matchedExam === 'UNIT TEST') examType = 'UT';
      else if (matchedExam === 'CYCLE') examType = 'CAT';
      else examType = examMappings[matchedExam] || 'Unknown';
    } else if (monthMatch) {
      examType = examMappings[monthMatch[1].toUpperCase()] || 'Unknown';
    }

    console.log('Extracted metadata:', { year, semester, branch, examType });
    return { year, semester, branch, examType };
  } catch (error) {
    console.error('Failed to extract metadata:', {
      fileName,
      path,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      year: 'Unknown',
      semester: 'Unknown',
      branch: 'Unknown',
      examType: 'Unknown'
    };
  }
}

async function crawlDirectory(path: string): Promise<void> {
  const items = await fetchDirectory(path);
  
  for (const item of items) {
    if (item.isDirectory) {
      await crawlDirectory(item.path);
    } else if (item.path.endsWith('.pdf')) {
      const metadata = extractMetadata(item.path, item.name);
      addToStructure(path, item, metadata);
    }
  }
}

async function main() {
  console.log('Starting crawler...');
  
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Reset the document state
    pyqDocument = {
      lastUpdated: new Date(),
      stats: {
        totalFiles: 0,
        totalDirectories: 0
      },
      structure: {} as DirectoryNode,
      meta: {
        years: new Set<string>(),
        branches: new Set<string>(),
        examTypes: new Set<string>(),
        semesters: new Set<string>()
      }
    };

    // Start crawling
    await crawlDirectory(BASE_URL);

    // Convert Sets to Arrays for MongoDB storage
    const finalDocument = {
      ...pyqDocument,
      meta: {
        years: Array.from(pyqDocument.meta.years).sort(),
        branches: Array.from(pyqDocument.meta.branches).sort(),
        examTypes: Array.from(pyqDocument.meta.examTypes).sort(),
        semesters: Array.from(pyqDocument.meta.semesters).sort()
      }
    };

    // Save to MongoDB
    await PYQ.findOneAndReplace({}, finalDocument, { upsert: true });

    console.log('\nCrawler finished successfully');
    console.log('Total files:', pyqDocument.stats.totalFiles);
    console.log('Total directories:', pyqDocument.stats.totalDirectories);
    console.log('Years:', finalDocument.meta.years);
    console.log('Branches:', finalDocument.meta.branches);
    console.log('Exam Types:', finalDocument.meta.examTypes);
    console.log('Semesters:', finalDocument.meta.semesters);

  } catch (error) {
    console.error('Crawler failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the crawler
main(); 