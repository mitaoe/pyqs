import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { 
  branchMappings, 
  yearMappings, 
  examMappings, 
  semesterMappings,
  STANDARD_VALUES,
  firstYearPatterns,
  SUBJECTS
} from '../config/mappings';
import PaperModel from '../models/Paper';
import DirectoryModel from '../models/Directory';
import { DirectoryNode, Paper, CleanNode } from '../types/paper';

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
    // Ensure proper URL encoding
    let normalizedPath = path;
    
    // Special handling for known problematic characters
    if (path.includes('&') && !path.includes('%26')) {
      // Replace & with %26 if not already encoded
      normalizedPath = path.replace(/&/g, '%26');
      if (VERBOSE) {
        log('INFO', `Fixed URL encoding for ampersand: ${path} -> ${normalizedPath}`);
      }
    }
    
    const response = await fetch(normalizedPath, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      // If the encoding fix didn't work and we modified the URL, try the original
      if (normalizedPath !== path && response.status === 404) {
        log('INFO', `Encoded URL failed, trying original: ${path}`);
        return fetchDirectory(path);
      }
      
      throw new Error(`Failed to fetch directory: ${response.status}`);
    }

    const html = await response.text();
    const items = parseDirectoryListing(html, normalizedPath);
    log('INFO', `Found ${items.length} items in ${normalizedPath}`);
    
    // Check if we received an empty directory but it might be due to encoding issues
    if (items.length === 0 && normalizedPath.includes('%')) {
      log('INFO', 'Empty directory with encoded URL, trying to decode and retry');
      // Try a different encoding approach in case the server expects a different format
      const decodedPath = decodeURIComponent(normalizedPath);
      if (decodedPath !== normalizedPath && decodedPath !== path) {
        log('INFO', `Trying decoded URL: ${decodedPath}`);
        return fetchDirectory(decodedPath);
      }
    }
    
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
    if (VERBOSE) {
      log('INFO', `Branch: First Year -> COMMON for ${fileName}`);
    }
    return STANDARD_VALUES.BRANCHES.COMMON;
  }
  
  const pathParts = getPathParts(path);
  const upperFileName = fileName.toUpperCase();
  
  // Special case for MTech identification
  if (upperFileName.includes('M.TECH') || upperFileName.includes('MTECH') || 
      upperFileName.includes('M TECH') || path.includes('M.TECH') || 
      path.includes('MTECH') || path.includes('M TECH')) {
    if (VERBOSE) {
      log('INFO', `Branch Match (MTech): ${fileName} -> ${STANDARD_VALUES.BRANCHES.MTECH}`);
    }
    return STANDARD_VALUES.BRANCHES.MTECH;
  }
  
  // Special case for Re-Exams
  if (upperFileName.includes('RE EXAM') || upperFileName.includes('RE-EXAM') || 
      path.includes('RE EXAM') || path.includes('RE-EXAM') || 
      path.includes('DEC Re Exam')) {
    // Try to find the actual branch within the file name or path
    // This helps with "DEC Re Exam" cases that were previously failing
    for (const [abbr, branch] of Object.entries(branchMappings)) {
      if (abbr === 'BTECH' || abbr === 'COMMON' || abbr === 'MTECH') continue; // Skip generic entries
      
      const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedAbbr}\\b`, 'i');
      
      if (regex.test(upperFileName)) {
        if (VERBOSE) {
          log('INFO', `Branch Match (Re-Exam): ${fileName} -> ${branch}`);
        }
        return branch;
      }
      
      for (const part of pathParts) {
        if (regex.test(part)) {
          if (VERBOSE) {
            log('INFO', `Branch Match (Re-Exam Path): ${fileName} -> ${branch}`);
          }
          return branch;
        }
      }
    }
  }
  
  // Try to find branch in the filename
  for (const [abbr, branch] of Object.entries(branchMappings)) {
    // Make sure we match whole words or word boundaries to avoid partial matches
    // Escape special characters in the abbreviation to avoid regex errors
    const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedAbbr}\\b`, 'i');
    if (regex.test(upperFileName)) {
      if (VERBOSE) {
        log('INFO', `Branch Match (Filename): ${fileName} -> ${branch}`);
        log('INFO', `Match pattern: ${abbr}`);
      }
      return branch;
    }
  }
  
  // Check in path parts
  for (const part of pathParts) {
    for (const [abbr, branch] of Object.entries(branchMappings)) {
      // Escape special characters in the abbreviation to avoid regex errors
      const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedAbbr}\\b`, 'i');
      if (regex.test(part)) {
        if (VERBOSE) {
          log('INFO', `Branch Match (Path): ${fileName} -> ${branch}`);
          log('INFO', `Match pattern: ${abbr} in path part: ${part}`);
        }
        return branch;
      }
    }
  }
  
  // If we have "BTECH" in the filename or path but no specific branch
  // mark it as COMMON as a fallback
  if (upperFileName.includes('BTECH') || upperFileName.includes('B.TECH') || 
      upperFileName.includes('B TECH')) {
    if (VERBOSE) {
      log('INFO', `Branch Fallback (BTech): ${fileName} -> ${STANDARD_VALUES.BRANCHES.COMMON}`);
    }
    return STANDARD_VALUES.BRANCHES.COMMON;
  }
  
  // Check path parts for BTech indicators
  for (const part of pathParts) {
    if (part.includes('BTECH') || part.includes('B.TECH') || part.includes('B TECH')) {
      if (VERBOSE) {
        log('INFO', `Branch Fallback (BTech Path): ${fileName} -> ${STANDARD_VALUES.BRANCHES.COMMON}`);
      }
      return STANDARD_VALUES.BRANCHES.COMMON;
    }
  }
  
  if (VERBOSE) {
    log('ERROR', `Branch Extraction Failed: ${fileName}`);
    log('INFO', `File Path: ${path}`);
    log('INFO', `Path Parts: ${pathParts.join(' | ')}`);
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
function extractSubject(fileName: string, verbose: boolean): { subject: string; standardSubject: string } {
  const fileNameUpper = fileName.toUpperCase();
  
  // Special case handling
  
  // IoT Networks and Protocols
  if (
    fileNameUpper.includes('IOT') && 
    (fileNameUpper.includes('NETWORK') || fileNameUpper.includes('PROTOCOL'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: IoT Networks', { fileName });
    }
      return {
      subject: 'IoT Networks and Protocols',
      standardSubject: SUBJECTS.IOT_NETWORKS.standard
    };
  }
  
  // Robot Dynamics and Control
  if (
    fileNameUpper.includes('ROBOT') && 
    (fileNameUpper.includes('DYNAMIC') || fileNameUpper.includes('CONTROL'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Robot Dynamics', { fileName });
    }
        return {
      subject: 'Robot Dynamics and Control',
      standardSubject: SUBJECTS.ROBOT_DYNAMICS.standard
    };
  }

  // Design and Analysis of Algorithms
  if (
    (fileNameUpper.includes('DESIGN') || fileNameUpper.includes('ANALYSIS')) && 
    fileNameUpper.includes('ALGORITHM')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Design and Analysis of Algorithms', { fileName });
    }
    return {
      subject: 'Design and Analysis of Algorithms',
      standardSubject: SUBJECTS.ALGORITHMS.standard
    };
  }

  // Database Management Systems
  if (
    fileNameUpper.includes('DATABASE') || 
    fileNameUpper.includes('DBMS') ||
    (fileNameUpper.includes('DATA') && fileNameUpper.includes('BASE'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Database Management Systems', { fileName });
    }
    return {
      subject: 'Database Management Systems',
      standardSubject: SUBJECTS.DATABASE_SYSTEMS.standard
    };
  }

  // Electromagnetic Theory
  if (
    fileNameUpper.includes('ELECTROMAGNET') || 
    (fileNameUpper.includes('ELECTRO') && fileNameUpper.includes('MAGNETIC'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Electromagnetic Theory', { fileName });
    }
          return {
      subject: 'Electromagnetic Theory',
      standardSubject: 'Electromagnetic Theory' // No corresponding entry in SUBJECTS
    };
  }

  // Microcontroller and Interfacing
  if (
    fileNameUpper.includes('MICROCONTROL') || 
    fileNameUpper.includes('MICRO CONTROL') ||
    (fileNameUpper.includes('MICRO') && fileNameUpper.includes('INTERFAC'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Microcontroller and Interfacing', { fileName });
    }
    return {
      subject: 'Microcontroller and Interfacing',
      standardSubject: 'Microcontroller and Interfacing' // No corresponding entry in SUBJECTS
    };
  }

  // Network Analysis
  if (
    (fileNameUpper.includes('NETWORK') && fileNameUpper.includes('ANALYSIS')) ||
    fileNameUpper.includes('NETWORK ANALYSIS')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Network Analysis', { fileName });
    }
    return {
      subject: 'Network Analysis and Techniques',
      standardSubject: 'Network Analysis and Techniques' // No corresponding entry in SUBJECTS
    };
  }

  // Signals and Systems
  if (
    (fileNameUpper.includes('SIGNAL') && fileNameUpper.includes('SYSTEM')) ||
    fileNameUpper.includes('SIGNALS AND SYSTEMS')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Signals and Systems', { fileName });
    }
      return {
      subject: 'Signals and Systems',
      standardSubject: SUBJECTS.SIGNALS_SYSTEMS.standard
    };
  }

  // Strength of Materials
  if (
    (fileNameUpper.includes('STRENGTH') && fileNameUpper.includes('MATERIAL')) ||
    fileNameUpper.includes('STRENGTH OF MATERIALS')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Strength of Materials', { fileName });
    }
    return {
      subject: 'Strength of Materials',
      standardSubject: 'Strength of Materials' // No corresponding entry in SUBJECTS
    };
  }

  // Software Engineering
  if (
    fileNameUpper.includes('SOFTWARE') && 
    (fileNameUpper.includes('ENGINEERING') || fileNameUpper.includes('ENGG'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Software Engineering', { fileName });
    }
    return {
      subject: 'Software Engineering',
      standardSubject: SUBJECTS.SOFTWARE_ENGINEERING.standard
    };
  }

  // Predictive Analytics
  if (
    fileNameUpper.includes('PREDICTIVE ANALYTICS') || 
    fileNameUpper.includes('PREDICTRIVE ANALYTICS')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Predictive Analytics', { fileName });
    }
    return {
      subject: 'Predictive Analytics',
      standardSubject: SUBJECTS.PREDICTIVE_ANALYTICS.standard
    };
  }
  
  // Computational Intelligence
  if (
    fileNameUpper.includes('COMPUTATIONAL INTELLIGENCE') || 
    fileNameUpper.includes('COMPUATIONAL INTELLGENCE') ||
    fileNameUpper.includes('COMPUTER INTELLIGENCE')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Computational Intelligence', { fileName });
    }
    return {
      subject: 'Computational Intelligence',
      standardSubject: SUBJECTS.COMPUTATIONAL_INTELLIGENCE.standard
    };
  }
  
  // Cyber Security
  if (
    fileNameUpper.includes('CYBER SECURITY') || 
    fileNameUpper.includes('CYBR SECURITY') ||
    fileNameUpper.includes('CRYPTOGRAPHY') || 
    fileNameUpper.includes('SYSTEM SECURITY')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Cyber Security', { fileName });
    }
    return {
      subject: 'Cyber Security and Forensics',
      standardSubject: SUBJECTS.CYBER_SECURITY.standard
    };
  }
  
  // Operation Research
  if (
    fileNameUpper.includes('OPERATION RESEARCH') || 
    fileNameUpper.includes('OPRATION RESERTCH') ||
    fileNameUpper.includes('OPERATIONAL RESEARCH')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Operation Research', { fileName });
    }
    return {
      subject: 'Operation Research',
      standardSubject: SUBJECTS.OPERATION_RESEARCH.standard
    };
  }
  
  // Water Resources Engineering
  if (
    fileNameUpper.includes('WATER RESOURCE') || 
    fileNameUpper.includes('WATER RESOURCES')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Water Resources Engineering', { fileName });
    }
    return {
      subject: 'Water Resources Engineering',
      standardSubject: SUBJECTS.WATER_RESOURCES.standard
    };
  }
  
  // Turbomachines
  if (fileNameUpper.includes('TURBOMACHINE')) {
    if (verbose) {
      log('METADATA', 'Subject Match: Turbomachines', { fileName });
    }
    return {
      subject: 'Turbomachines',
      standardSubject: 'Turbomachines' // No corresponding entry in SUBJECTS
    };
  }

  // Digital Signal Processing
  if (
    (fileNameUpper.includes('DIGITAL') && fileNameUpper.includes('SIGNAL') && fileNameUpper.includes('PROCESS')) ||
    fileNameUpper.includes('DSP')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Digital Signal Processing', { fileName });
    }
    return {
      subject: 'Digital Signal Processing',
      standardSubject: SUBJECTS.DIGITAL_SIGNAL_PROCESSING.standard
    };
  }

  // Operating System
  if (
    fileNameUpper.includes('OPERATING SYSTEM') || 
    fileNameUpper.includes('OPERATING SYS') ||
    fileNameUpper.includes('OS ')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Operating System', { fileName });
    }
    return {
      subject: 'Operating System',
      standardSubject: SUBJECTS.OPERATING_SYSTEMS.standard
    };
  }

  // Real Time Operating System
  if (
    (fileNameUpper.includes('REAL') && fileNameUpper.includes('TIME') && 
     (fileNameUpper.includes('OPERATING') || fileNameUpper.includes('OS'))) ||
    fileNameUpper.includes('RTOS')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Real Time Operating System', { fileName });
    }
    return {
      subject: 'Real Time Operating System',
      standardSubject: SUBJECTS.REAL_TIME_OS.standard
    };
  }

  // Antenna Theory
  if (
    fileNameUpper.includes('ANTENNA') && 
    (fileNameUpper.includes('THEORY') || fileNameUpper.includes('DESIGN'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Antenna Theory', { fileName });
    }
    return {
      subject: 'Antenna Theory and Design',
      standardSubject: SUBJECTS.ANTENNA_THEORY.standard
    };
  }

  // Manufacturing Technology
  if (
    fileNameUpper.includes('MANUFACTURING') || 
    (fileNameUpper.includes('MANUFACT') && fileNameUpper.includes('TECH'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Manufacturing Technology', { fileName });
    }
    return {
      subject: 'Manufacturing Technology',
      standardSubject: 'Manufacturing Technology' // No corresponding entry in SUBJECTS
    };
  }

  // Kinematics and Dynamics of Robots
  if (
    (fileNameUpper.includes('KINEMAT') || fileNameUpper.includes('DYNAMIC')) && 
    fileNameUpper.includes('ROBOT')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Kinematics and Dynamics of Robots', { fileName });
    }
    return {
      subject: 'Kinematics and Dynamics of Robots',
      standardSubject: 'Kinematics and Dynamics of Robots' // No corresponding entry in SUBJECTS
    };
  }

  // Vehicle Dynamics
  if (
    fileNameUpper.includes('VEHICLE') && 
    fileNameUpper.includes('DYNAMIC')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Vehicle Dynamics', { fileName });
    }
    return {
      subject: 'Vehicle Dynamics',
      standardSubject: SUBJECTS.VEHICLE_DYNAMICS.standard
    };
  }

  // Computer Architecture
  if (
    (fileNameUpper.includes('COMPUTER') && fileNameUpper.includes('ARCHITECT')) ||
    fileNameUpper.includes('COMP ARCHITECT')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Computer Architecture', { fileName });
    }
    return {
      subject: 'Computer Architecture',
      standardSubject: SUBJECTS.COMPUTER_ORGANIZATION.standard
    };
  }

  // Engineering Mathematics
  if (
    (fileNameUpper.includes('ENGINEERING') && fileNameUpper.includes('MATH')) ||
    (fileNameUpper.includes('ENGG') && fileNameUpper.includes('MATH'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Engineering Mathematics', { fileName });
    }
    return {
      subject: 'Engineering Mathematics',
      standardSubject: SUBJECTS.ENGINEERING_MATHEMATICS_1.standard // Use Math 1 as a default
    };
  }

  // Power Electronics
  if (
    fileNameUpper.includes('POWER') && 
    fileNameUpper.includes('ELECTRON')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Power Electronics', { fileName });
    }
    return {
      subject: 'Power Electronics',
      standardSubject: SUBJECTS.POWER_ELECTRONICS.standard
    };
  }

  // Engineering Economics
  if (
    (fileNameUpper.includes('ENGINEERING') || fileNameUpper.includes('ENGG')) && 
    fileNameUpper.includes('ECONOMIC')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Engineering Economics', { fileName });
    }
    return {
      subject: 'Engineering Economics',
      standardSubject: 'Engineering Economics' // No corresponding entry in SUBJECTS
    };
  }

  // Soft Computing
  if (
    fileNameUpper.includes('SOFT') && 
    fileNameUpper.includes('COMPUT')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Soft Computing', { fileName });
    }
    return {
      subject: 'Soft Computing',
      standardSubject: SUBJECTS.SOFT_COMPUTING.standard
    };
  }

  // Engineering Drawing/Graphics
  if (
    (fileNameUpper.includes('ENGINEERING') || fileNameUpper.includes('ENGG')) && 
    (fileNameUpper.includes('DRAWING') || fileNameUpper.includes('GRAPHIC'))
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Engineering Drawing', { fileName });
    }
    return {
      subject: 'Engineering Drawing',
      standardSubject: SUBJECTS.ENGINEERING_GRAPHICS.standard
    };
  }

  // Thermodynamics
  if (
    fileNameUpper.includes('THERMODYNAMIC') || 
    fileNameUpper.includes('THERMO DYNAMIC') ||
    fileNameUpper.includes('THERMO-DYNAMIC')
  ) {
    if (verbose) {
      log('METADATA', 'Subject Match: Thermodynamics', { fileName });
    }
    return {
      subject: 'Thermodynamics',
      standardSubject: SUBJECTS.THERMODYNAMICS.standard
    };
  }

  // Default case - return unknown
  if (verbose) {
    log('METADATA', 'Subject Not Matched', { fileName });
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
    const { subject, standardSubject } = extractSubject(fileName, VERBOSE);
    
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
    // Connect to database only if not in test mode
    if (!TEST_MODE || DEBUG_MODE) {
    db = await connectToMongoDB();
    } else {
      log('INFO', 'Test mode enabled - skipping database connection');
    }
    
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
    
    // Only save to database if in debug mode or not in test mode
    if (!TEST_MODE || DEBUG_MODE) {
    // Delete existing documents
    await Promise.all([
        DirectoryModel.deleteMany({}),
        PaperModel.deleteMany({})
    ]);
    
    log('METADATA', `Deleted existing documents. Found ${paperCollection.papers.length} papers to insert.`);
    
    // Clean directory structure for storage
    const cleanedStructure = cleanStructure(directoryStructure);
    
    // Insert new documents
    const [paperResult, directoryResult] = await Promise.all([
      // Insert paper collection
        PaperModel.create({
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
    } else {
      // For test mode, show a summary of found papers
      log('METADATA', 'Crawler completed in test mode - no data saved to database', {
        papersCount: paperCollection.papers.length,
        uniqueYears: paperCollection.meta.years.length,
        uniqueBranches: paperCollection.meta.branches.length,
        uniqueExamTypes: paperCollection.meta.examTypes.length,
        uniqueSemesters: paperCollection.meta.semesters.length,
        uniqueSubjects: paperCollection.meta.subjects.length,
        uniqueStandardSubjects: paperCollection.meta.standardSubjects.length,
        uniqueSubjectValues: paperCollection.meta.subjects,
        uniqueStandardSubjectValues: paperCollection.meta.standardSubjects,
        directoryStats: directoryStructure.stats
      });
      
      // If in test mode with verbose, print subject extraction stats
      if (TEST_MODE && VERBOSE) {
        // Count papers by subject
        const subjectCounts: Record<string, number> = {};
        const standardSubjectCounts: Record<string, number> = {};
        
        paperCollection.papers.forEach(paper => {
          subjectCounts[paper.subject] = (subjectCounts[paper.subject] || 0) + 1;
          standardSubjectCounts[paper.standardSubject] = (standardSubjectCounts[paper.standardSubject] || 0) + 1;
        });
        
        // Count papers with unknown subjects
        const unknownCount = subjectCounts['Unknown'] || 0;
        const knownCount = paperCollection.papers.length - unknownCount;
        
        log('METADATA', 'Subject Extraction Statistics', {
          total: paperCollection.papers.length,
          identified: knownCount,
          unidentified: unknownCount,
          identificationRate: `${((knownCount / paperCollection.papers.length) * 100).toFixed(2)}%`,
          subjectCounts,
          standardSubjectCounts
        });
      }
    }
    
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