import mongoose from 'mongoose';
import * as cheerio from 'cheerio';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://pravaahi:ZZHBnKcyCzmvkmxz@cluster0.oit0r.mongodb.net/pyqs";
const BASE_URL = 'http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/';

// Paper Schema
const PaperSchema = new mongoose.Schema({
  fileName: String,
  downloadUrl: String,
  originalUrl: { type: String, unique: true },
  year: String,
  branch: String,
  semester: String,
  examType: String,
  path: String  // Full path from root
}, {
  timestamps: true
});

// Directory Schema
const DirectorySchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  parent: String,
  type: {
    type: String,
    enum: ['year', 'academicYear', 'branch', 'exam'],
    required: true
  },
  papers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper'
  }]
}, {
  timestamps: true
});

// Create models
const Paper = mongoose.models.Paper || mongoose.model('Paper', PaperSchema);
const Directory = mongoose.models.Directory || mongoose.model('Directory', DirectorySchema);

interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

// Helper function to determine directory type
function getDirectoryType(path: string, name: string): 'year' | 'academicYear' | 'branch' | 'exam' {
  if (/^20\d{2}$/.test(name.replace(/\s+/g, ''))) return 'year';
  if (/^(FY|SY|TY|F Y|S Y|T Y|FIRST YEAR|SECOND YEAR|THIRD YEAR)$/i.test(name)) return 'academicYear';
  if (/(Chemical|Computer|Civil|ENTC|ETX|IT|Mechanical)/i.test(name)) return 'branch';
  if (/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+20\d{2}/i.test(name)) return 'exam';
  return 'branch'; // default to branch if unsure
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
    console.log('Received HTML length:', html.length);
    
    const items = parseDirectoryListing(html, path);
    console.log(`Found ${items.length} items:`, items.map(i => i.name).join(', '));
    return items;
  } catch (error) {
    console.error(`Failed to fetch directory ${path}:`, error);
    return [];
  }
}

function parseDirectoryListing(html: string, currentPath: string): DirectoryItem[] {
  const items: DirectoryItem[] = [];
  const $ = cheerio.load(html);

  console.log('\nParsing directory listing...');

  // Find all links in the directory listing
  $('a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');
    const name = $link.text().trim();

    // Skip parent directory link
    if (name === '[To Parent Directory]' || !href) {
      return;
    }

    console.log('\nProcessing link:', { name, href });

    // Check if it's a directory (ends with /)
    if (href.endsWith('/')) {
      // Clean up directory name (remove spaces between digits)
      const cleanName = name.replace(/\s+/g, '');
      console.log('Found directory:', cleanName);
      
      items.push({
        name: cleanName,
        isDirectory: true,
        path: new URL(href, currentPath).href
      });
    }
    // Check if it's a PDF file
    else if (href.endsWith('.pdf')) {
      console.log('Found file:', name);
      items.push({
        name,
        isDirectory: false,
        path: new URL(href, currentPath).href
      });
    }
  });

  console.log(`\nFound ${items.length} valid items`);
  items.forEach(item => console.log(`- ${item.isDirectory ? 'DIR' : 'FILE'}: ${item.name}`));

  return items;
}

async function crawlDirectory(path: string, parentPath: string = '', depth: number = 0): Promise<void> {
  const indent = '  '.repeat(depth);
  console.log(`${indent}Crawling directory:`, path);
  
  const items = await fetchDirectory(path);
  console.log(`${indent}Found ${items.length} items`);
  
  for (const item of items) {
    if (item.isDirectory) {
      // Create directory entry
      const dirPath = decodeURIComponent(item.path.split('/DigitalLibrary/')[1]);
      const dirType = getDirectoryType(dirPath, item.name);
      
      try {
        await Directory.findOneAndUpdate(
          { path: dirPath },
          {
            path: dirPath,
            name: item.name,
            parent: parentPath || null,
            type: dirType,
            papers: []
          },
          { upsert: true, new: true }
        );
        console.log(`${indent}Created directory:`, { path: dirPath, type: dirType });
      } catch (error) {
        console.error(`${indent}Failed to create directory ${dirPath}:`, error);
      }

      // Recursively crawl subdirectory
      await crawlDirectory(item.path, dirPath, depth + 1);
    } else if (item.path.endsWith('.pdf')) {
      const filePath = decodeURIComponent(item.path.split('/DigitalLibrary/')[1]);
      const downloadUrl = `http://43.227.20.36:82/DigitalLibrary/${item.path.split('/DigitalLibrary')[1]}`;
      
      // Extract metadata
      const pathParts = decodeURIComponent(item.path).split('/');
      const year = pathParts.find(p => /^2\s*0\s*\d\s*\d$/.test(p))?.replace(/\s+/g, '') || 
                  pathParts.find(p => /^20\d{2}$/.test(p)) || 
                  'Unknown';

      // Extract academic year from both path and filename
      const academicYearMap: { [key: string]: string } = {
        'FY': 'FY',
        'FE': 'FY',
        'SY': 'SY',
        'TY': 'TY',
        'F Y': 'FY',
        'S Y': 'SY',
        'T Y': 'TY',
        'FIRST YEAR': 'FY',
        'SECOND YEAR': 'SY',
        'THIRD YEAR': 'TY',
        'BTECH': 'BTech',
        'B TECH': 'BTech',
        'B.TECH': 'BTech'
      };

      // Try to find academic year in path first
      let academicYear = 'Unknown';
      for (const part of pathParts) {
        const cleanPart = part.trim().toUpperCase();
        if (academicYearMap[cleanPart]) {
          academicYear = academicYearMap[cleanPart];
          break;
        }
      }

      // If not found in path, try filename
      if (academicYear === 'Unknown') {
        const fileNameMatch = item.name.match(/^(FY|SY|TY|F Y|S Y|T Y|FIRST YEAR|SECOND YEAR|THIRD YEAR|BTECH|B TECH|B\.TECH)[-_\s]/i);
        if (fileNameMatch) {
          academicYear = academicYearMap[fileNameMatch[1].toUpperCase()];
        }
      }

      // Extract branch from path and filename
      const branchMap: { [key: string]: string } = {
        'CH': 'CHEMICAL',
        'CHEM': 'CHEMICAL',
        'CS': 'COMPUTER',
        'COMP': 'COMPUTER',
        'CV': 'CIVIL',
        'ET': 'ENTC',
        'EX': 'ETX',
        'IT': 'IT',
        'ME': 'MECHANICAL',
        'MECH': 'MECHANICAL'
      };

      const branchMatch = item.name.match(/[_\s](CH|CS|CV|ET|EX|IT|ME|CHEM|COMP|CIVIL|ENTC|ETX|Chemical|Computer|Civil|Mechanical)[_\s]/i) ||
                         pathParts.find(p => /(Chemical|Computer|Civil|ENTC|ETX|IT|Mechanical)/i.test(p))?.match(/(Chemical|Computer|Civil|ENTC|ETX|IT|Mechanical)/i);
      
      const branch = branchMatch ? 
        branchMap[branchMatch[1].toUpperCase()] || branchMatch[1].toUpperCase() : 
        'Unknown';

      // Extract semester from filename
      const semMatch = item.name.match(/SEM[ester]*[\s-]*([IVX]+)/i) ||
                      item.name.match(/Semester[\s-]*([IVX]+)/i);
      const semester = semMatch ? `Semester ${semMatch[1]}` : 'Unknown';

      // Extract exam type from filename and path
      const monthToExamType: { [key: string]: string } = {
        'JAN': 'ESE', 'FEB': 'ESE', 'MAR': 'ESE',
        'APR': 'ESE', 'MAY': 'ESE', 'JUN': 'ESE',
        'JUL': 'MSE', 'AUG': 'MSE', 'SEP': 'MSE',
        'OCT': 'MSE', 'NOV': 'ESE', 'DEC': 'ESE'
      };

      const examTypeMatch = item.name.match(/(?:^|\s)(MSE|ESE|UT|CAT|END COURSE|CYCLE \d+)(?:\s|$)/i) ||
                           item.name.match(/(?:^|\s)(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s|$)/i) ||
                           pathParts.find(p => /(END\s*COURSE|MID\s*TERM|UNIT\s*TEST)/i.test(p))?.match(/(END\s*COURSE|MID\s*TERM|UNIT\s*TEST)/i);
      
      let examType = 'Unknown';
      
      if (examTypeMatch?.[1]) {
        const type = examTypeMatch[1].toUpperCase();
        if (/END\s*COURSE/i.test(type)) examType = 'ESE';
        else if (/MID\s*TERM/i.test(type)) examType = 'MSE';
        else if (/UNIT\s*TEST/i.test(type)) examType = 'UT';
        else if (/CYCLE/i.test(type)) examType = 'CAT';
        else if (monthToExamType[type]) examType = monthToExamType[type];
        else examType = type;
      }

      // Find exam period (e.g., "DEC 2018", "MAY 2019")
      const examPeriod = pathParts.find(p => /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+20\d{2}$/i.test(p)) || 'Unknown';

      try {
        // Create/update paper
        const paper = await Paper.findOneAndUpdate(
          { originalUrl: item.path },
          {
            fileName: item.name,
            downloadUrl,
            originalUrl: item.path,
            path: filePath,
            year,
            branch,
            semester,
            examType
          },
          { upsert: true, new: true }
        );

        // Add paper to parent directory
        if (paper && parentPath) {
          await Directory.findOneAndUpdate(
            { path: parentPath },
            { $addToSet: { papers: paper._id } }
          );
        }

        console.log(`${indent}Stored paper:`, {
          name: item.name,
          path: filePath
        });
      } catch (error) {
        console.error(`${indent}Failed to store paper ${item.path}:`, error);
      }
    }
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Paper.deleteMany({});
    await Directory.deleteMany({});
    console.log('Cleared existing data');

    console.log('Starting crawler...');
    await crawlDirectory(BASE_URL);
    
    // Print final stats
    const paperCount = await Paper.countDocuments();
    const dirCount = await Directory.countDocuments();
    console.log('\nCrawler finished successfully');
    console.log(`Total papers stored: ${paperCount}`);
    console.log(`Total directories stored: ${dirCount}`);
  } catch (error) {
    console.error('Crawler failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the crawler
main(); 