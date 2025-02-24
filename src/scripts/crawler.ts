import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { branchMappings, yearMappings, examMappings, semesterMappings, subjectBranchMappings } from '@/config/mappings';
import path from 'path';
import fs from 'fs';
import PYQModel from '@/models/Paper';

const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL = 'http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/';

// Parse command line arguments
const args = process.argv.slice(2);
const DEBUG_MODE = args.includes('--debug') || args.includes('-d');

// Logger setup
const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, `crawler-errors-${new Date().toISOString().split('T')[0]}.log`);
const METADATA_LOG_FILE = path.join(LOG_DIR, `crawler-metadata-${new Date().toISOString().split('T')[0]}.log`);

// Create logs directory if it doesn't exist
if (DEBUG_MODE) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger function
function log(level: 'INFO' | 'ERROR' | 'METADATA', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

  // Only log errors and metadata to console
  if (level === 'ERROR') {
    console.error(logMessage);
  } else if (level === 'METADATA') {
    console.log(logMessage);
  }

  // In debug mode, write to appropriate files
  if (DEBUG_MODE) {
    try {
      if (level === 'ERROR') {
        fs.appendFileSync(ERROR_LOG_FILE, logMessage);
      } else if (level === 'METADATA') {
        fs.appendFileSync(METADATA_LOG_FILE, logMessage);
      }
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }
}

interface Paper {
  year: string;
  examType: string;
  branch: string;
  semester: string;
  fileName: string;
  url: string;
  isDirectory?: boolean;
}

interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
}

interface DirectoryMeta {
  years: Set<string>;
  branches: Set<string>;
  examTypes: Set<string>;
  semesters: Set<string>;
}

interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  parent?: DirectoryNode;
  children: Record<string, DirectoryNode>;
  stats: DirectoryStats;
  metadata?: Paper;
  meta: DirectoryMeta;
}

interface DirectoryStructure extends DirectoryNode {}

interface SavedDocument {
  _id: string;
  structure: DirectoryStructure;
  stats: DirectoryStats;
  meta: {
    years: string[];
    branches: string[];
    examTypes: string[];
    semesters: string[];
  };
  lastUpdated: Date;
}

type CleanNode = Omit<DirectoryNode, 'parent'> & {
  children?: Record<string, CleanNode>;
};

interface PYQDocument {
  _id: any;
  lastUpdated: Date;
  stats: {
    totalFiles: number;
    totalDirectories: number;
  };
  structure: {
    name: string;
    path: string;
    type: 'directory' | 'file';
    stats: {
      totalFiles: number;
      totalDirectories: number;
    };
    children?: Record<string, any>;
    metadata?: Paper;
  };
  meta: {
    years: string[];
    branches: string[];
    examTypes: string[];
    semesters: string[];
  };
}

// Single document schema
const PYQSchema = new mongoose.Schema({
  lastUpdated: Date,
  stats: {
    totalFiles: { type: Number, required: true },
    totalDirectories: { type: Number, required: true }
  },
  structure: {
    name: { type: String, required: true },
    path: { type: String, required: true },
    type: { type: String, enum: ['directory', 'file'], required: true },
    stats: {
      totalFiles: { type: Number, required: true },
      totalDirectories: { type: Number, required: true }
    },
    children: { type: mongoose.Schema.Types.Mixed },
    metadata: {
      fileName: String,
      url: String,
      year: String,
      branch: String,
      examType: String,
      semester: String
    }
  },
  meta: {
    years: [{ type: String }],
    branches: [{ type: String }],
    examTypes: [{ type: String }],
    semesters: [{ type: String }]
  }
}, {
  strict: false // Allow mixed type for nested children
});

const PYQ = mongoose.models.PYQ || mongoose.model<PYQDocument>('PYQ', PYQSchema);

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
  return name.replace(/\s+/g, ' ').trim();
}

function getPathParts(path: string): string[] {
  const parts = path.split('/Old Question Papers/B Tech (Autonomy)/')[1]?.split('/') || [];
  return parts.filter(part => part.length > 0).map(cleanName);
}

async function fetchDirectory(path: string): Promise<DirectoryItem[]> {
  log('INFO', 'Fetching directory:', path);
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
    log('INFO', `Found ${items.length} items in ${path}`);
    return items;
  } catch (error) {
    log('ERROR', `Failed to fetch directory ${path}:`, error);
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
        name: name,
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

async function addToStructure(structure: DirectoryStructure, paper: Paper) {
  const sanitizedFileName = sanitizeKey(paper.fileName);
  const parts = getPathParts(paper.url);
  let current = structure;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const sanitizedPart = sanitizeKey(part);
    const isLast = i === parts.length - 1;
    const fullPath = parts.slice(0, i + 1).join('/');

    if (!current.children[sanitizedPart]) {
      current.children[sanitizedPart] = {
        name: part,
        path: fullPath,
        type: isLast && !paper.isDirectory ? 'file' : 'directory',
        parent: current,
        children: {},
        stats: { totalFiles: 0, totalDirectories: 0 },
        meta: {
          years: new Set<string>(),
          branches: new Set<string>(),
          examTypes: new Set<string>(),
          semesters: new Set<string>()
        }
      };

      // Update directory stats
      if (!isLast || paper.isDirectory) {
        current.stats.totalDirectories++;
      }
    }

    if (isLast && !paper.isDirectory) {
      current.children[sanitizedPart].metadata = paper;
      current.stats.totalFiles++;

      // Update metadata sets
      if (paper.year !== 'Unknown') {
        structure.meta.years.add(paper.year);
      }
      if (paper.branch !== 'Unknown') {
        structure.meta.branches.add(paper.branch);
      }
      if (paper.examType !== 'Unknown') {
        structure.meta.examTypes.add(paper.examType);
      }
      if (paper.semester !== 'Unknown') {
        structure.meta.semesters.add(paper.semester);
      }
    }

    current = current.children[sanitizedPart];
  }
}

function sanitizeKey(key: string): string {
  return key.replace(/\./g, '_');
}

function extractSemester(path: string, fileName: string): string {
  const pathParts = path.split('/').map(p => p.trim());
  const semMatch = fileName.match(/SEM[ester]*[\s-]*([IVX\d]+)/i) ||
                  fileName.match(/Semester[\s-]*([IVX\d]+)/i) ||
                  pathParts.find(p => /SEM[ester]*[\s-]*([IVX\d]+)/i.test(p))?.match(/SEM[ester]*[\s-]*([IVX\d]+)/i);
  const rawSemester = semMatch?.[1]?.toUpperCase() || 'Unknown';
  return semesterMappings[rawSemester] || 'Unknown';
}

function extractExamType(path: string, fileName: string): string {
  const pathParts = path.split('/').map(p => p.trim());
  const examPattern = Object.keys(examMappings).join('|');
  const examRegex = new RegExp(`(?:^|[_\\s-])(${examPattern}|END COURSE|UNIT TEST|CYCLE)(?:[_\\s-]|$)`, 'i');
  const examMatch = fileName.match(examRegex) ||
                   pathParts.find(p => examRegex.test(p))?.match(examRegex);
  
  // If no direct exam type match, try to extract from month
  const monthRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;
  const monthMatch = fileName.match(monthRegex) ||
                    pathParts.find(p => monthRegex.test(p))?.match(monthRegex);
  
  if (examMatch) {
    const matchedExam = examMatch[1].toUpperCase();
    if (matchedExam === 'END COURSE') return 'ESE';
    if (matchedExam === 'UNIT TEST') return 'UT';
    if (matchedExam === 'CYCLE') return 'CAT';
    return examMappings[matchedExam] || 'Unknown';
  } 
  
  if (monthMatch) {
    return examMappings[monthMatch[1].toUpperCase()] || 'Unknown';
  }

  return 'Unknown';
}

function extractMetadata(path: string, fileName: string): Paper {
  try {
    if (!path || !fileName) {
      log('ERROR', 'Missing path or filename:', { path, fileName });
      return {
        fileName: fileName || 'Unknown',
        url: path || 'Unknown',
        year: 'Unknown',
        semester: 'Unknown',
        branch: 'Unknown',
        examType: 'Unknown'
      };
    }
    
    const metadata: Paper = {
      fileName,
      url: path,
      year: extractYear(path, fileName),
      semester: extractSemester(path, fileName),
      branch: extractBranch(path, fileName),
      examType: extractExamType(path, fileName)
    };

    // Only log metadata if something was successfully extracted
    if (Object.values(metadata).some(value => value !== 'Unknown')) {
      log('METADATA', 'Extracted metadata:', metadata);
    } else {
      log('ERROR', 'Failed to extract any metadata:', {
        file: fileName,
        path
      });
    }

    return metadata;
  } catch (error) {
    log('ERROR', 'Failed to extract metadata:', {
      fileName,
      path,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      fileName,
      url: path,
      year: 'Unknown',
      semester: 'Unknown',
      branch: 'Unknown',
      examType: 'Unknown'
    };
  }
}

async function crawlDirectory(structure: DirectoryStructure, url: string) {
  const items = await fetchDirectory(url);
  
  for (const item of items) {
    if (item.path.endsWith('.pdf')) {
      const metadata = extractMetadata(item.path, item.name);
      await addToStructure(structure, { ...metadata, isDirectory: false });
    } else if (item.isDirectory) {
      const metadata = { fileName: item.name, url: item.path, isDirectory: true } as Paper;
      await addToStructure(structure, metadata);
      await crawlDirectory(structure, item.path);
    }
  }
}

function removeParentRefs(node: DirectoryNode): CleanNode {
  const { parent, children, ...rest } = node;
  const cleanNode = { ...rest } as CleanNode;
  
  if (children) {
    cleanNode.children = {};
    for (const [key, child] of Object.entries(children)) {
      cleanNode.children[key] = removeParentRefs(child);
    }
  }
  
  return cleanNode;
}

async function connectToMongoDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  await mongoose.connect(MONGODB_URI);
  log('METADATA', 'Connected to MongoDB');
}

function cleanStructure(node: DirectoryNode): DirectoryNode {
  const cleanNode = {
    ...node,
    parent: undefined,
    children: {} as Record<string, DirectoryNode>
  };

  for (const [key, child] of Object.entries(node.children)) {
    cleanNode.children[key] = cleanStructure(child);
  }

  return cleanNode;
}

async function crawl() {
  try {
    await connectToMongoDB();
    
    // Initialize root structure
    const structure: DirectoryStructure = {
      name: 'root',
      path: BASE_URL,
      type: 'directory',
      parent: undefined,
      children: {},
      stats: { totalFiles: 0, totalDirectories: 1 }, // Count root as first directory
      meta: {
        years: new Set<string>(),
        branches: new Set<string>(),
        examTypes: new Set<string>(),
        semesters: new Set<string>()
      }
    };

    // Process files recursively
    await crawlDirectory(structure, BASE_URL);

    // Delete existing documents
    log('METADATA', 'Deleted existing documents');
    await PYQModel.deleteMany({});

    // Convert sets to arrays for storage
    const metaArrays = {
      years: Array.from(structure.meta.years),
      branches: Array.from(structure.meta.branches),
      examTypes: Array.from(structure.meta.examTypes),
      semesters: Array.from(structure.meta.semesters)
    };

    // Save new document
    const result = await PYQModel.create({
      structure: cleanStructure(structure),
      meta: metaArrays,
      stats: structure.stats,
      lastUpdated: new Date()
    });

    log('METADATA', 'Document created with ID:', result._id);

    // Verify the saved document
    const savedDoc = await PYQModel.findById(result._id).lean() as unknown as SavedDocument;
    
    if (!savedDoc) {
      throw new Error('Failed to verify saved document');
    }

    log('METADATA', 'Document saved successfully:', {
      id: savedDoc._id,
      stats: savedDoc.stats,
      metaCounts: {
        years: metaArrays.years.length,
        branches: metaArrays.branches.length,
        examTypes: metaArrays.examTypes.length,
        semesters: metaArrays.semesters.length
      },
      structureStats: {
        hasRoot: savedDoc.structure?.name != null,
        rootStats: savedDoc.structure?.stats || { totalFiles: 0, totalDirectories: 0 },
        childrenCount: Object.keys(savedDoc.structure?.children || {}).length
      },
      lastUpdated: savedDoc.lastUpdated
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    log('METADATA', 'Disconnected from MongoDB');
  }
}

// Run the crawler
crawl();