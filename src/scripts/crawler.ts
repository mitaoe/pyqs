import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { 
  STANDARD_VALUES, 
  SUBJECTS, 
  branchMappings, 
  yearMappings, 
  examMappings, 
  semesterMappings,
  firstYearPatterns
} from '@/config/mappings';
import path from 'path';
import fs from 'fs';
import PYQModel from '@/models/Paper';
import DirectoryModel from '@/models/Directory';
import { DirectoryNode, Paper, CleanNode } from '@/types/paper';

const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL = 'http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/';
const DEFAULT_TEST_DIR = '/2%200%201%206/'; // Default test directory

// Parse command line arguments
const args = process.argv.slice(2);
const DEBUG_MODE = args.includes('--debug') || args.includes('-d');
const TEST_MODE = args.includes('--test') || args.includes('-t');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// Get custom test directory if provided
const testDirIndex = args.indexOf('--test-dir');
const TEST_DIR = testDirIndex !== -1 && args[testDirIndex + 1] 
  ? args[testDirIndex + 1] 
  : DEFAULT_TEST_DIR;

// Logger setup
const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, `crawler-errors-${new Date().toISOString().split('T')[0]}.log`);
const METADATA_LOG_FILE = path.join(LOG_DIR, `crawler-metadata-${new Date().toISOString().split('T')[0]}.log`);

// Create logs directory if it doesn't exist
if (DEBUG_MODE) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Simple logger function
function log(level: 'INFO' | 'ERROR' | 'METADATA', message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

  // Console logging based on verbosity
  if (level === 'ERROR' || VERBOSE || level === 'METADATA') {
    if (level === 'ERROR') {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  // File logging in debug mode
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

// Helper interface for directory items
interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

// Clean string helper
function cleanString(str: string): string {
  return str.replace(/\s+/g, ' ').trim().toUpperCase();
}

// Extract path parts for analysis
function getPathParts(path: string): string[] {
  const decodedPath = decodeURIComponent(path);
  const basePath = '/Old Question Papers/B Tech (Autonomy)/';
  const parts = decodedPath.split(basePath)[1]?.split('/') || [];
  return parts.filter(part => part.length > 0).map(cleanString);
}

// Fetch directory contents
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

// Parse HTML directory listing
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

// Extract year from path or filename
function extractYear(path: string, fileName: string): string {
  // First try to extract year from the path (e.g., /2 0 1 6/)
  const pathYearMatch = path.match(/\/2\s*0\s*(\d\s*\d)/);
  if (pathYearMatch) {
    const year = pathYearMatch[0].replace(/\s+/g, '').slice(1); // Remove leading slash and spaces
    if (year >= '2000' && year <= '2025') {
      return year;
    }
  }

  // Try to extract full 4-digit year from filename
  const fileYearMatch = fileName.match(/20\d{2}/);
  if (fileYearMatch) {
    const year = fileYearMatch[0];
    if (year >= '2000' && year <= '2025') {
      return year;
    }
  }

  // Check for academic year patterns and map them
  const upperFileName = fileName.toUpperCase();
  for (const [pattern, mappedYear] of Object.entries(yearMappings)) {
    if (upperFileName.includes(pattern)) {
      return mappedYear;
    }
  }

  // Check dir path for year indicators
  const pathParts = getPathParts(path);
  for (const part of pathParts) {
    if (part.includes('DEC') || part.includes('NOV') || part.includes('OCT')) {
      const yearMatch = part.match(/\b20\d{2}\b/);
      if (yearMatch) {
        return yearMatch[0];
      }
    }
  }

  return 'Unknown';
}

// Check if a file is likely a first-year paper
function isFirstYearPaper(fileName: string, path: string): boolean {
  const upperFileName = fileName.toUpperCase();
  
  // Check for explicit first-year patterns
  for (const pattern of firstYearPatterns) {
    if (pattern.test(upperFileName)) {
      return true;
    }
  }
  
  // Check path parts for first year indicators
  const pathParts = getPathParts(path);
  for (const part of pathParts) {
    for (const pattern of firstYearPatterns) {
      if (pattern.test(part)) {
        return true;
      }
    }
  }
  
  return false;
}

// Extract branch information
function extractBranch(path: string, fileName: string): string {
  // Check if it's a first-year paper, which should be marked as COMMON
  if (isFirstYearPaper(fileName, path)) {
    return STANDARD_VALUES.BRANCHES.COMMON;
  }
  
  const pathParts = getPathParts(path);
  const upperFileName = fileName.toUpperCase();
  
  // Try to find branch in the filename
  for (const [abbr, branch] of Object.entries(branchMappings)) {
    // Make sure we match whole words or word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${abbr}\\b`, 'i');
    if (regex.test(upperFileName)) {
      return branch;
    }
  }
  
  // Check in path parts
  for (const part of pathParts) {
    for (const [abbr, branch] of Object.entries(branchMappings)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'i');
      if (regex.test(part)) {
        return branch;
      }
    }
  }
  
  return 'Unknown';
}

// Extract semester information
function extractSemester(path: string, fileName: string): string {
  const upperFileName = fileName.toUpperCase();
  
  // Look for semester pattern in filename
  const semRegex = /SEM(?:ESTER)?[\s-]*([IVX\d]+)/i;
  const semMatch = upperFileName.match(semRegex);
  
  if (semMatch && semMatch[1]) {
    const semValue = semMatch[1].trim();
    if (semesterMappings[semValue]) {
      return semesterMappings[semValue];
    }
  }
  
  // Check mappings directly
  for (const [pattern, value] of Object.entries(semesterMappings)) {
    // Use word boundary to avoid partial matches
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(upperFileName)) {
      return value;
    }
  }
  
  // If it's a first-year paper and semester not found, default to Semester 1
  if (isFirstYearPaper(fileName, path)) {
    return STANDARD_VALUES.SEMESTERS.SEM1;
  }
  
  return 'Unknown';
}

// Extract exam type
function extractExamType(path: string, fileName: string): string {
  const upperFileName = fileName.toUpperCase();
  const pathParts = getPathParts(path);
  
  // Check path for Re-Exam indicators
  for (const part of pathParts) {
    if (part.includes('RE EXAM') || part.includes('REEXAM') || part.includes('RE-EXAM')) {
      return STANDARD_VALUES.EXAM_TYPES.ESE;
    }
  }
  
  // Direct mapping check in filename
  for (const [pattern, value] of Object.entries(examMappings)) {
    // Use word boundary to avoid partial matches
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(upperFileName)) {
      return value;
    }
  }
  
  // Check path parts
  for (const part of pathParts) {
    for (const [pattern, value] of Object.entries(examMappings)) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(part)) {
        return value;
      }
    }
  }
  
  // Special cases
  if (upperFileName.includes('END COURSE')) return STANDARD_VALUES.EXAM_TYPES.ESE;
  if (upperFileName.includes('UNIT TEST')) return STANDARD_VALUES.EXAM_TYPES.UT;
  if (upperFileName.includes('CYCLE')) return STANDARD_VALUES.EXAM_TYPES.CAT;
  
  return 'Unknown';
}

// Extract subject information
function extractSubject(fileName: string, path: string): { subject: string, standardSubject: string } {
  const upperFileName = fileName.toUpperCase();
  
  // Check against known subject variations
  for (const subjectInfo of Object.values(SUBJECTS)) {
    // Check against standard name
    if (upperFileName.includes(subjectInfo.standard.toUpperCase())) {
      return {
        subject: subjectInfo.standard,
        standardSubject: subjectInfo.standard
      };
    }
    
    // Check against variations
    for (const variation of subjectInfo.variations) {
      // Use more specific matching to avoid false positives
      const regex = new RegExp(`\\b${variation}\\b`, 'i');
      if (regex.test(upperFileName)) {
        return {
          subject: variation,
          standardSubject: subjectInfo.standard
        };
      }
    }
  }
  
  // If this is a first-year paper, try to extract subject from the file name
  if (isFirstYearPaper(fileName, path)) {
    // Common patterns for subject names in first-year papers
    // These often appear between underscores or after "BTech_" prefix
    const subjectPatterns = [
      /_([A-Za-z\s&]+)_SEM/i,
      /BTech_([A-Za-z\s&]+)_/i,
      /(?:_|-)([A-Za-z\s&]+?)(?:_|-)/i
    ];
    
    for (const pattern of subjectPatterns) {
      const match = upperFileName.match(pattern);
      if (match && match[1]) {
        const potentialSubject = match[1].trim();
        if (potentialSubject.length > 3) {
          return {
            subject: potentialSubject,
            standardSubject: 'Unknown'
          };
        }
      }
    }
  }
  
  // If no match, try to extract something that looks like a subject
  // Look for capitalized words that might be part of a subject name
  const potentialSubjectMatch = upperFileName.match(/(?:[A-Z]{2,}\s?)+(?=\s|$)/);
  if (potentialSubjectMatch) {
    const potentialSubject = potentialSubjectMatch[0].trim();
    if (potentialSubject.length > 3 && !potentialSubject.match(/^(MSE|ESE|CAT|UT|SEM|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/)) {
      return {
        subject: potentialSubject,
        standardSubject: 'Unknown'
      };
    }
  }
  
  return {
    subject: 'Unknown',
    standardSubject: 'Unknown'
  };
}

// Extract all metadata from a file
function extractMetadata(path: string, fileName: string): Paper {
  try {
    const year = extractYear(path, fileName);
    const branch = extractBranch(path, fileName);
    const semester = extractSemester(path, fileName);
    const examType = extractExamType(path, fileName);
    const { subject, standardSubject } = extractSubject(fileName, path);
    
    const metadata: Paper = {
      fileName,
      url: path,
      year,
      semester,
      branch,
      examType,
      subject,
      standardSubject
    };

    if (DEBUG_MODE && (subject !== 'Unknown' || standardSubject !== 'Unknown')) {
      log('METADATA', 'Extracted subject information:', { 
        fileName, 
        subject, 
        standardSubject 
      });
    }

    // Only log complete metadata in verbose mode
    if (VERBOSE) {
      log('METADATA', 'Extracted metadata:', metadata);
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
      examType: 'Unknown',
      subject: 'Unknown',
      standardSubject: 'Unknown'
    };
  }
}

// Simplified document structure for MongoDB
interface PaperCollection {
  papers: Paper[];
  meta: {
    years: string[];
    branches: string[];
    examTypes: string[];
    semesters: string[];
    subjects: string[];
    standardSubjects: string[];
  };
  stats: {
    totalFiles: number;
    totalDirectories: number;
    lastUpdated: Date;
  };
}

// Helper function to add unique values to metadata arrays
function addUniqueValue(arr: string[], value: string) {
  if (value !== 'Unknown' && !arr.includes(value)) {
    arr.push(value);
  }
}

// Sanitize key to make it valid for MongoDB
function sanitizeKey(key: string): string {
  return key.replace(/\./g, '_').replace(/[$]/g, '_');
}

// Update directory structure with a paper
async function addToStructure(
  structure: DirectoryNode, 
  paper: Paper, 
  isDirectory: boolean = false
): Promise<void> {
  const parts = getPathParts(paper.url);
  let current = structure;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const sanitizedPart = sanitizeKey(part);
    const isLast = i === parts.length - 1;
    const fullPath = parts.slice(0, i + 1).join('/');

    if (!current.children[sanitizedPart]) {
      const nodeType = isLast && !isDirectory ? 'file' : 'directory';
      current.children[sanitizedPart] = {
        name: part,
        path: fullPath,
        type: nodeType,
        parent: current,
        stats: { totalFiles: 0, totalDirectories: 0 },
        children: {},
        meta: {
          papers: [],
          years: [],
          branches: [],
          examTypes: [],
          semesters: [],
          subjects: [],
          standardSubjects: []
        }
      };

      const deltaFiles = nodeType === 'file' ? 1 : 0;
      const deltaDirectories = nodeType === 'directory' ? 1 : 0;
      propagateStats(current, deltaFiles, deltaDirectories);
    }

    if (isLast && !isDirectory) {
      current.children[sanitizedPart].metadata = paper;

      // Update metadata arrays
      const currentNode = current.children[sanitizedPart];
      
      // Update current node's metadata
      addUniqueValue(currentNode.meta.years, paper.year);
      addUniqueValue(currentNode.meta.branches, paper.branch);
      addUniqueValue(currentNode.meta.examTypes, paper.examType);
      addUniqueValue(currentNode.meta.semesters, paper.semester);
      addUniqueValue(currentNode.meta.subjects, paper.subject);
      addUniqueValue(currentNode.meta.standardSubjects, paper.standardSubject);
      currentNode.meta.papers.push(paper);

      // Propagate metadata up the hierarchy
      let node: DirectoryNode | undefined = current;
      while (node) {
        addUniqueValue(node.meta.years, paper.year);
        addUniqueValue(node.meta.branches, paper.branch);
        addUniqueValue(node.meta.examTypes, paper.examType);
        addUniqueValue(node.meta.semesters, paper.semester);
        addUniqueValue(node.meta.subjects, paper.subject);
        addUniqueValue(node.meta.standardSubjects, paper.standardSubject);
        node.meta.papers.push(paper);
        node = node.parent;
      }
    }

    current = current.children[sanitizedPart];
  }
}

// Propagate stats up the directory hierarchy
function propagateStats(node: DirectoryNode | undefined, deltaFiles: number, deltaDirectories: number) {
  let currentNode = node;
  while (currentNode) {
    currentNode.stats.totalFiles += deltaFiles;
    currentNode.stats.totalDirectories += deltaDirectories;
    currentNode = currentNode.parent;
  }
}

// Clean structure by removing circular parent references for storage
function cleanStructure(node: DirectoryNode): CleanNode {
  // Use proper destructuring to exclude parent without creating unused variable
  const { children, ...rest } = node;
  const cleanedChildren: Record<string, CleanNode> = {};

  // Clean each child recursively
  for (const [key, child] of Object.entries(children)) {
    cleanedChildren[key] = cleanStructure(child);
  }

  return {
    ...rest,
    children: cleanedChildren
  };
}

// Main crawling function that builds both collections
async function crawlDirectory(
  baseUrl: string, 
  paperCollection: PaperCollection,
  directoryStructure: DirectoryNode
): Promise<void> {
  const items = await fetchDirectory(baseUrl);
  
  for (const item of items) {
    if (item.isDirectory) {
      // For directories, recursively crawl
      paperCollection.stats.totalDirectories++;
      
      // Add directory to structure
      const dirMetadata = {
        fileName: item.name,
        url: item.path,
        year: extractYear(item.path, item.name),
        branch: extractBranch(item.path, item.name),
        semester: extractSemester(item.path, item.name),
        examType: extractExamType(item.path, item.name),
        subject: 'Unknown',
        standardSubject: 'Unknown',
        isDirectory: true
      };
      
      await addToStructure(directoryStructure, dirMetadata, true);
      await crawlDirectory(item.path, paperCollection, directoryStructure);
      
    } else if (item.path.endsWith('.pdf')) {
      // For PDF files, extract metadata and add to collections
      const metadata = extractMetadata(item.path, item.name);
      
      // Add to flat paper collection
      paperCollection.papers.push(metadata);
      paperCollection.stats.totalFiles++;
      
      // Update metadata in flat collection
      addUniqueValue(paperCollection.meta.years, metadata.year);
      addUniqueValue(paperCollection.meta.branches, metadata.branch);
      addUniqueValue(paperCollection.meta.examTypes, metadata.examType);
      addUniqueValue(paperCollection.meta.semesters, metadata.semester);
      addUniqueValue(paperCollection.meta.subjects, metadata.subject);
      addUniqueValue(paperCollection.meta.standardSubjects, metadata.standardSubject);
      
      // Add to directory structure
      await addToStructure(directoryStructure, metadata);
    }
  }
}

// Connect to MongoDB
async function connectToMongoDB(): Promise<mongoose.Connection> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(MONGODB_URI);
  log('METADATA', 'Connected to MongoDB');
  return mongoose.connection;
}

// Run the crawler
async function runCrawler() {
  let db: mongoose.Connection | undefined;
  
  try {
    // Connect to database
    db = await connectToMongoDB();
    
    // Initialize flat collection structure
    const paperCollection: PaperCollection = {
      papers: [],
      meta: {
        years: [],
        branches: [],
        examTypes: [],
        semesters: [],
        subjects: [],
        standardSubjects: []
      },
      stats: {
        totalFiles: 0,
        totalDirectories: 0,
        lastUpdated: new Date()
      }
    };
    
    // Initialize directory structure
    const directoryStructure: DirectoryNode = {
      name: 'root',
      path: BASE_URL,
      type: 'directory',
      children: {},
      stats: { totalFiles: 0, totalDirectories: 0 },
      meta: {
        papers: [],
        years: [],
        branches: [],
        examTypes: [],
        semesters: [],
        subjects: [],
        standardSubjects: []
      }
    };
    
    // Choose URL based on mode
    const startUrl = TEST_MODE ? BASE_URL + TEST_DIR : BASE_URL;
    log('INFO', `Starting crawler in ${TEST_MODE ? 'TEST' : 'FULL'} mode at ${startUrl}`);
    
    // Start crawling
    await crawlDirectory(startUrl, paperCollection, directoryStructure);
    
    // Process complete - update stats
    paperCollection.stats.lastUpdated = new Date();
    
    // Delete existing documents
    await Promise.all([
      PYQModel.deleteMany({}),
      DirectoryModel.deleteMany({})
    ]);
    
    log('METADATA', `Deleted existing documents. Found ${paperCollection.papers.length} papers to insert.`);
    
    // Clean directory structure for storage
    const cleanedStructure = cleanStructure(directoryStructure);
    
    // Insert new documents
    const [paperResult, directoryResult] = await Promise.all([
      // Insert paper collection
      PYQModel.create({
        papers: paperCollection.papers,
        meta: paperCollection.meta,
        stats: paperCollection.stats
      }),
      
      // Insert directory structure
      DirectoryModel.create({
        structure: cleanedStructure,
        meta: directoryStructure.meta,
        stats: directoryStructure.stats,
        lastUpdated: new Date()
      })
    ]);
    
    log('METADATA', 'Crawler completed successfully!', {
      paperDocumentId: paperResult._id,
      directoryDocumentId: directoryResult._id,
      papersCount: paperCollection.papers.length,
      uniqueYears: paperCollection.meta.years,
      uniqueBranches: paperCollection.meta.branches,
      uniqueExamTypes: paperCollection.meta.examTypes,
      uniqueSemesters: paperCollection.meta.semesters,
      uniqueSubjects: paperCollection.meta.subjects.length,
      uniqueStandardSubjects: paperCollection.meta.standardSubjects.length,
      directoryStats: directoryStructure.stats
    });
    
  } catch (error) {
    log('ERROR', 'Crawler failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      details: error
    });
    throw error; // Re-throw to see the full error in the console
  } finally {
    if (db) {
      await mongoose.disconnect();
      log('INFO', 'Disconnected from MongoDB');
    }
  }
}

// Execute the crawler
runCrawler(); 