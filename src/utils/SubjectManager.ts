/**
 * SubjectManager - A utility class to manage subject classification
 * 
 * This class handles:
 * - Loading subject data from JSON files
 * - Subject identification from filenames based on variations
 * - Adding new subjects and variations
 * - Managing exclusions
 */

import fs from 'fs/promises';
import path from 'path';

// Define types for the JSON structures
interface SubjectData {
  standard: string; // The standardized subject name
}

interface SubjectsJson {
  [key: string]: SubjectData; // Maps subject keys to subject data
}

interface VariationsJson {
  [variation: string]: string; // Maps filename variations to subject keys
}

type ExclusionsJson = string[]; // List of file paths to exclude
type UnclassifiedJson = string[]; // List of unclassified file paths

export class SubjectManager {
  private dataDir: string;
  private subjects: SubjectsJson = {};
  private variations: VariationsJson = {};
  private exclusions: ExclusionsJson = [];
  private unclassified: UnclassifiedJson = [];
  private initialized = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
  }

  /**
   * Initialize the SubjectManager by loading all JSON data files
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureDataDirExists();
      await this.loadSubjects();
      await this.loadVariations();
      await this.loadExclusions();
      await this.loadUnclassified();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize SubjectManager:', error);
      throw new Error('Failed to initialize SubjectManager');
    }
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirExists(): Promise<void> {
    try {
      // Check if the data directory exists
      await fs.access(this.dataDir);
    } catch {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(this.dataDir, { recursive: true });
      } catch (error: unknown) {
        // Handle error properly
        console.error(`Failed to create data directory: ${this.dataDir}`, error instanceof Error ? error.message : String(error));
        throw error; // Re-throw error to propagate it
      }
    }
  }

  /**
   * Check if a file is excluded from processing
   */
  public isExcluded(filePath: string): boolean {
    // Normalize both the input path and stored exclusion paths
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Check if the normalized path is in exclusions
    if (this.exclusions.includes(normalizedPath)) {
      return true;
    }
    
    // Also check if the filename without the path is in exclusions (for backward compatibility)
    const fileName = normalizedPath.split('/').pop() || '';
    if (this.exclusions.includes(fileName)) {
      return true;
    }
    
    // Also check for partial matches - if any exclusion ends with this path
    for (const exclusion of this.exclusions) {
      const normalizedExclusion = exclusion.replace(/\\/g, '/');
      
      // Check if paths end with the same segments
      if (normalizedPath.endsWith(normalizedExclusion) || normalizedExclusion.endsWith(normalizedPath)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get subject information from a filename variation
   */
  public getSubjectFromVariation(variation: string): { subjectKey: string, standard: string } | null {
    const subjectKey = this.variations[variation];
    if (!subjectKey || !this.subjects[subjectKey]) {
      return null;
    }
    
    return {
      subjectKey,
      standard: this.subjects[subjectKey].standard
    };
  }

  /**
   * Get all matching variations for a filename
   */
  public getMatchingVariations(subjectPart: string, verbose = false): { variation: string, subjectKey: string, standard: string }[] {
    const matches: { variation: string, subjectKey: string, standard: string }[] = [];
    
    // Convert to uppercase for case-insensitive matching and normalize spaces
    const upperSubjectPart = subjectPart.toUpperCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
    
    // Only show debugging info when verbose mode is on
    if (verbose) {
      console.log(`[DEBUG] Looking for variations in: "${upperSubjectPart}"`);
      console.log(`[DEBUG] Available variations: ${Object.keys(this.variations).slice(0, 5).join(", ")}...`);
    }
    
    // Check for variations in our list
    for (const [variation, subjectKey] of Object.entries(this.variations)) {
      // Normalize the variation by replacing underscores with spaces and trimming
      const normalizedVariation = variation.trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
      
      // Add exact string equality check too for direct matching
      const exactMatch = upperSubjectPart === normalizedVariation;
      
      // Special check for specific full filenames like FE-BTECH_PHYSICS_SEM I_DEC 2016
      // Need to handle case differences more aggressively
      const fileNameMatch = upperSubjectPart.replace(/\s/g, '') === normalizedVariation.replace(/\s/g, '');
      
      // Three types of matches:
      // 1. If subject contains the variation (original case)
      //    Example: "COMPUTER PROGRAMMING" contains "COMPUTER"
      // 2. If a word in subject exactly matches the variation (for abbreviations/short forms)
      //    Example: "RE ANALOG ETX" contains entire token "ETX"
      // 3. If variation has multiple words, check if ALL words appear in the subject
      //    Example: "ANALOG ETX" words all appear in "RE ANALOG ETX CYCLE"
      
      const variationWords = normalizedVariation.split(' ').filter(w => w.length > 0);
      const subjectWords = upperSubjectPart.split(' ').filter(w => w.length > 0);
      
      // Case 1: Subject contains the entire variation as a substring
      const containsVariation = upperSubjectPart.includes(normalizedVariation);
      
      // Case 2: One of the subject words is exactly the variation (for abbreviations)
      const exactWordMatch = 
        normalizedVariation.length > 1 && // Avoid matching single letters
        subjectWords.some(word => word === normalizedVariation);
        
      // Case 3: All variation words appear in the subject
      const allWordsMatch = 
        variationWords.length > 1 && // Only for multi-word variations
        variationWords.every(word => 
          word.length > 1 && // Skip single letters
          upperSubjectPart.includes(word)
        );
      
      if (exactMatch || fileNameMatch || containsVariation || exactWordMatch || allWordsMatch) {
        if (this.subjects[subjectKey]) {
          matches.push({
            variation: normalizedVariation,
            subjectKey,
            standard: this.subjects[subjectKey].standard
          });
          
          // Only show debug info when verbose mode is on
          if (verbose) {
            console.log(`[DEBUG] Found match: "${normalizedVariation}" -> ${subjectKey}`);
            if (exactMatch) console.log("  (exact match)");
            if (fileNameMatch) console.log("  (filename match)");
            if (containsVariation) console.log("  (contains variation)");
            if (exactWordMatch) console.log("  (exact word match)");
            if (allWordsMatch) console.log("  (all words match)");
          }
        }
      }
    }
    
    // Sort by variation length (longest/most specific first)
    return matches.sort((a, b) => b.variation.length - a.variation.length);
  }

  /**
   * Load subjects from subjects.json
   */
  private async loadSubjects(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'subjects.json');
      const data = await fs.readFile(filePath, 'utf8');
      this.subjects = JSON.parse(data);
    } catch (error: unknown) {
      // If file doesn't exist or can't be parsed, create an empty object
      console.warn('Failed to load subjects, using empty data.', error instanceof Error ? error.message : String(error));
      this.subjects = {};
    }
  }

  /**
   * Load variations from variations.json
   */
  private async loadVariations(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'variations.json');
      const data = await fs.readFile(filePath, 'utf8');
      this.variations = JSON.parse(data);
    } catch (error: unknown) {
      // If file doesn't exist or can't be parsed, create an empty object
      console.warn('Failed to load variations, using empty data.', error instanceof Error ? error.message : String(error));
      this.variations = {};
    }
  }

  /**
   * Load exclusions from exclusions.json
   */
  private async loadExclusions(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'exclusions.json');
      const data = await fs.readFile(filePath, 'utf8');
      this.exclusions = JSON.parse(data);
    } catch (error: unknown) {
      // If file doesn't exist or can't be parsed, create an empty array
      console.warn('Failed to load exclusions, using empty data.', error instanceof Error ? error.message : String(error));
      this.exclusions = [];
    }
  }

  /**
   * Load unclassified files from unclassified.json
   */
  private async loadUnclassified(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'unclassified.json');
      const data = await fs.readFile(filePath, 'utf8');
      this.unclassified = JSON.parse(data);
    } catch (error: unknown) {
      // If file doesn't exist or can't be parsed, create an empty array
      console.warn('Failed to load unclassified, using empty data.', error instanceof Error ? error.message : String(error));
      this.unclassified = [];
    }
  }

  /**
   * Save subjects to subjects.json
   */
  private async saveSubjects(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'subjects.json');
      await fs.writeFile(filePath, JSON.stringify(this.subjects, null, 2));
    } catch (error) {
      console.error('Failed to save subjects:', error);
    }
  }

  /**
   * Save variations to variations.json
   */
  private async saveVariations(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'variations.json');
      await fs.writeFile(filePath, JSON.stringify(this.variations, null, 2));
    } catch (error) {
      console.error('Failed to save variations:', error);
    }
  }

  /**
   * Save exclusions to exclusions.json
   */
  private async saveExclusions(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'exclusions.json');
      await fs.writeFile(filePath, JSON.stringify(this.exclusions, null, 2));
    } catch (error) {
      console.error('Failed to save exclusions:', error);
    }
  }

  /**
   * Save unclassified files to unclassified.json
   */
  private async saveUnclassified(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'unclassified.json');
      await fs.writeFile(filePath, JSON.stringify(this.unclassified, null, 2));
    } catch (error) {
      console.error('Failed to save unclassified:', error);
    }
  }

  /**
   * Add a new subject
   */
  public async addSubject(subjectKey: string, standardName: string): Promise<void> {
    this.subjects[subjectKey] = {
      standard: standardName
    };
    
    await this.saveSubjects();
  }

  /**
   * Add a variation for a subject
   */
  public async addVariation(variation: string, subjectKey: string): Promise<void> {
    // Always store variations in uppercase for case-insensitive matching
    this.variations[variation.toUpperCase()] = subjectKey;
    
    await this.saveVariations();
  }

  /**
   * Add a file to exclusions
   */
  public async addExclusion(filePath: string): Promise<void> {
    if (!this.exclusions.includes(filePath)) {
      this.exclusions.push(filePath);
      
      // Remove from unclassified if it was there
      const index = this.unclassified.indexOf(filePath);
      if (index !== -1) {
        this.unclassified.splice(index, 1);
        await this.saveUnclassified();
      }
      
      await this.saveExclusions();
    }
  }

  /**
   * Get all exclusions
   */
  public getExclusions(): string[] {
    return [...this.exclusions];
  }

  /**
   * Add a file to unclassified
   */
  public async addUnclassified(filePath: string): Promise<void> {
    if (!this.unclassified.includes(filePath) && !this.isExcluded(filePath)) {
      this.unclassified.push(filePath);
      await this.saveUnclassified();
    }
  }

  /**
   * Get all unclassified files
   */
  public getUnclassified(): string[] {
    return [...this.unclassified];
  }

  /**
   * Get all subjects
   */
  public getSubjects(): SubjectsJson {
    return { ...this.subjects };
  }

  /**
   * Get all variations
   */
  public getVariations(): VariationsJson {
    return { ...this.variations };
  }

  /**
   * Map a file to a subject key (internal method for crawler)
   */
  public async addMapping(filePath: string, subjectKey: string): Promise<void> {
    // Remove from unclassified if it was there
    const index = this.unclassified.indexOf(filePath);
    if (index !== -1) {
      this.unclassified.splice(index, 1);
      await this.saveUnclassified();
    }

    // The file is now classified, no need to store in mappings anymore
    // We'll infer the subject from the variation when needed
    
    // Log the action
    console.log(`✅ Added mapping: "${filePath}" → ${subjectKey}`);
  }
} 