/**
 * seed:mongo
 *
 * Fetches the upstream papers metadata API and upserts it into MongoDB as the
 * single PYQ document that `GET /api/papers` reads back.
 *
 * The upstream endpoint returns the *response* shape (papers nested under
 * `meta.papers`, which is what our own /api/papers route emits). The stored
 * Mongoose document (models/Paper.ts -> PYQ) keeps `papers` at the top level
 * and `meta` without papers, so we reverse that mapping here.
 *
 * Idempotent: re-running replaces the same single document (findOneAndReplace
 * with upsert) and prunes any stray duplicates, converging on one document.
 *
 *   pnpm seed:mongo
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PYQ from '@/models/Paper';
import type { Paper } from '@/types/paper';

// Next.js keeps real values in .env.local; fall back to .env. dotenv does not
// override already-set vars, so load the higher-priority file first.
dotenv.config({ path: '.env.local' });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const PAPERS_API_URL = 'https://mitaoe-pyqs.vercel.app/api/papers';

// Fields the PaperSchema (models/Paper.ts) actually stores. Anything else in
// the upstream payload is dropped so the document matches the model exactly.
type SeedPaper = Paper & { isDirectory: boolean };

interface ApiMeta {
  years: string[];
  branches: string[];
  examTypes: string[];
  semesters: string[];
  subjects: string[];
  standardSubjects: string[];
  papers: Partial<SeedPaper>[];
}

interface ApiResponse {
  meta: ApiMeta;
  lastUpdated?: string;
  stats: {
    totalFiles: number;
    totalDirectories: number;
    lastUpdated: string;
  };
}

function log(message: string, data?: unknown): void {
  const stamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[seed:mongo] ${stamp} ${message}`, data);
  } else {
    console.log(`[seed:mongo] ${stamp} ${message}`);
  }
}

async function fetchPapers(): Promise<ApiResponse> {
  log(`Fetching ${PAPERS_API_URL}`);
  const res = await fetch(PAPERS_API_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'mitaoe-pyqs-seed' },
  });
  if (!res.ok) {
    throw new Error(`Papers API responded ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as ApiResponse;
  if (!data?.meta || !Array.isArray(data.meta.papers)) {
    throw new Error('Papers API payload missing meta.papers array');
  }
  return data;
}

/**
 * Map a raw upstream paper onto the exact PaperSchema shape, applying the same
 * defaults the schema declares. Returns null for entries missing a required
 * field so a malformed row can never poison the document.
 */
function toSeedPaper(raw: Partial<SeedPaper>): SeedPaper | null {
  const { fileName, url, year, branch, semester, examType } = raw;
  if (!fileName || !url || !year || !branch || !semester || !examType) {
    return null;
  }
  return {
    fileName,
    url,
    year,
    branch,
    semester,
    examType,
    subject: raw.subject || 'Unknown',
    standardSubject: raw.standardSubject || 'Unknown',
    isDirectory: raw.isDirectory ?? false,
  };
}

function transform(data: ApiResponse): {
  papers: SeedPaper[];
  meta: Omit<ApiMeta, 'papers'>;
  stats: { totalFiles: number; totalDirectories: number; lastUpdated: Date };
} {
  const { papers: rawPapers, ...meta } = data.meta;

  const papers: SeedPaper[] = [];
  let skipped = 0;
  for (const raw of rawPapers) {
    const paper = toSeedPaper(raw);
    if (paper) papers.push(paper);
    else skipped++;
  }
  if (skipped > 0) {
    log(`Skipped ${skipped} paper(s) missing required fields`);
  }
  if (papers.length === 0) {
    throw new Error('No valid papers to seed; refusing to overwrite the document');
  }

  const totalFiles = papers.length;
  if (data.stats?.totalFiles !== totalFiles) {
    log(
      `Note: upstream stats.totalFiles=${data.stats?.totalFiles} but ${totalFiles} valid papers; storing ${totalFiles}`,
    );
  }

  return {
    papers,
    meta,
    stats: {
      totalFiles,
      totalDirectories: data.stats?.totalDirectories ?? 0,
      // Preserve the upstream timestamp so identical source data seeds an
      // identical document (content-idempotent), not a new "now" each run.
      lastUpdated: new Date(data.stats?.lastUpdated ?? data.lastUpdated ?? Date.now()),
    },
  };
}

async function main(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined (set it in .env.local or .env)');
  }

  const data = await fetchPapers();
  const doc = transform(data);
  log(`Transformed ${doc.papers.length} papers`, {
    subjects: doc.meta.subjects.length,
    standardSubjects: doc.meta.standardSubjects.length,
    years: doc.meta.years.length,
    totalDirectories: doc.stats.totalDirectories,
    lastUpdated: doc.stats.lastUpdated.toISOString(),
  });

  await mongoose.connect(MONGODB_URI);
  log('Connected to MongoDB');

  try {
    // Idempotent upsert: replace the single PYQ document in place (or insert
    // if the collection is empty). Keeps the same _id across runs.
    const result = await PYQ.findOneAndReplace({}, doc, {
      upsert: true,
      new: true,
      sort: { lastUpdated: -1 },
    });

    // Guarantee a single-document collection: prune any strays a prior,
    // non-upserting seed may have left behind.
    const pruned = await PYQ.deleteMany({ _id: { $ne: result._id } });
    if (pruned.deletedCount > 0) {
      log(`Pruned ${pruned.deletedCount} duplicate PYQ document(s)`);
    }

    log('Upsert complete', {
      _id: String(result._id),
      papers: result.papers.length,
      totalFiles: result.stats.totalFiles,
    });
  } finally {
    await mongoose.disconnect();
    log('Disconnected from MongoDB');
  }
}

main().catch((err) => {
  console.error('[seed:mongo] Failed:', err);
  process.exit(1);
});
