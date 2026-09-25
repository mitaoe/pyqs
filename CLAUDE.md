# PROJECT: MITAoE PYQ Analytics + RAG

## Goal
A web app where students select a subject and ask questions about previous-year
question papers. Two query types:
1. ANALYTICS: "most frequently asked questions/topics" → answered by SQL over
   clustered questions with REAL COUNTS. Never answered by the LLM guessing.
2. SEMANTIC: open-ended questions → pgvector similarity search + Gemini synthesis,
   with citations to source papers.

## Non-negotiable rules
- The atomic unit is an individual QUESTION, never a page chunk or whole PDF.
- Subject isolation is enforced with a SQL WHERE clause on standard_subject,
  applied BEFORE vector search. Never rely on the LLM or prompt to keep
  subjects separate.
- Everything runs on free tiers: Neon Postgres (pgvector), Gemini Flash free
  tier, GitHub Actions for all heavy compute, Vercel for hosting,
  sentence-transformers locally in Actions for embeddings (NO paid embedding API).
- The user's PC never downloads or processes PDFs. All ingestion happens in
  GitHub Actions.
- PDFs are processed streaming: download one → extract → parse → save to DB →
  DELETE the PDF → next. Never store PDFs.

## Data source
- Metadata API: https://mitaoe-pyqs.vercel.app/api/papers
  Returns ~4,664 papers with fields: fileName, url, year, branch, semester,
  examType (ESE/MSE/CAT), subject, standardSubject.
- PDFs are served from a Cloudflare Worker (mitaoe-pyqs.c122.workers.dev). They
  are directly downloadable with a plain GET. Be polite: ≤2 concurrent
  downloads, small delay between requests.
- Most 2018–2024 PDFs have text layers (use pdfplumber / PyMuPDF).
  2016 and some 2025 PDFs are scanned images → OCR fallback with Tesseract
  (installed via apt in the Actions runner).

## Pipeline (GitHub Actions workflow: ingest.yml)
1. Fetch /api/papers → upsert all paper metadata into `papers` table with
   status = 'pending'.
2. Batch loop (default 300 papers per run):
   For each pending paper: download PDF → extract text → if <100 chars of
   text, OCR → send text to Gemini Flash with a strict JSON-output prompt:
   "Extract every question as JSON: [{question_text, marks, sub_question_label}]"
   → validate JSON → insert rows into `questions` → mark paper status='done'
   (or 'failed' with error message; never crash the run on one bad paper).
3. Rate limiting + KEY ROTATION: GEMINI_API_KEYS is a comma-separated list of
   free-tier keys, ALL shared between the pipeline and the runtime app. The
   pipeline rotates through the full set:
   sleep between calls to stay under per-minute limits; on 429 or daily-quota
   errors, mark that key exhausted (with a cooldown timestamp) and switch to
   the next key; when ALL keys are exhausted, exit cleanly — cron
   resumes later. Implement rotation as a small KeyManager class so both the
   extraction and any other Gemini call in the pipeline share it. Log which
   key index served each call (never log the key itself).
4. Embedding step: for all questions without embeddings, run
   sentence-transformers 'all-MiniLM-L6-v2' (CPU) and store 384-dim vectors
   in pgvector column.
5. Clustering step: per standard_subject, cluster questions by embedding
   similarity (agglomerative, cosine threshold ~0.80 to start; make it a
   config constant). Store cluster_id on questions, and a `clusters` table
   with representative_text and count.
6. Corpus-version step (LAST, after labeling): bump the `corpus_version`
   row and sweep the rows it retires. Every deterministic answer the runtime
   cached ("asked in 30 of 49 exams") was computed against the pre-ingest
   corpus, so the bump retires all of them at once.
7. Workflow is idempotent and resumable: progress lives in the DB, so re-runs
   only touch pending work. Schedule: cron every 4 hours until backlog is
   empty; then monthly for new papers.

## Database schema (Postgres + pgvector)
- papers(id, file_name, url, year, branch, semester, exam_type, subject,
  standard_subject, status, error, created_at)
- questions(id, paper_id FK, question_text, marks, sub_label,
  embedding vector(384), cluster_id, created_at)
- clusters(id, standard_subject, representative_text, question_count,
  papers_count, years_spanned)
- corpus_version(id=1, version, updated_at) — single row, bumped at the end
  of every ingest run; the freshness signal for cached deterministic answers.
- response_cache(cache_key PK, subject, normalized_question, filters_hash,
  intent, deterministic, corpus_version, response JSONB, expires_at, hits)
  — the SHARED cache behind /api/ask (see Providers below).
- Indexes: questions(cluster_id), papers(standard_subject, status),
  ivfflat index on embedding, response_cache(expires_at),
  response_cache(deterministic, corpus_version).

## Backend (Next.js API routes, deployed on Vercel)
- POST /api/ask { subject, question, history?, intent?, topic? }
  0. Cache check FIRST, before any provider call (see Providers below).
  1. Classify intent — regex-FIRST. A request carrying its own `intent`
     (quick-action buttons) skips classification entirely, and a query the
     regexes settle confidently onto a SQL-only intent costs no LLM call
     either. Only genuinely ambiguous or synthesis-bound queries reach the
     classification lane.
  2. ANALYTICS → SQL over clusters filtered by subject → format ranked list
     with counts and source paper links. LLM only formats, never invents.
  3. SEMANTIC → embed the query (sentence-transformers can't run on Vercel,
     so the same MiniLM weights run as quantized ONNX via transformers.js at
     QUERY TIME only) → pgvector search WHERE standard_subject = $1 → top 10
     questions with paper metadata → the synthesis lane writes the answer
     citing papers.
- GET /api/subjects → distinct standard_subject list with question counts.
- GET /api/health → DB reachability, per-lane provider availability with
  today's call counts, and the cache hit rate.

## Frontend (Next.js + Tailwind, same repo)
- Landing page: subject picker (searchable dropdown) → chat interface.
- Chat shows answers with expandable citations (paper name, year, exam type,
  link to original PDF on the worker URL).
- Prebuilt quick-action buttons: "Most repeated questions", "Topic-wise
  weightage", "Year-wise trend". Each sends its INTENT with the request, so
  the whole round trip costs zero LLM calls.
- Simple, fast, mobile-first. No login.

## Providers (runtime LLM lanes) + shared cache
Serving ~15K requests/day on free tiers is a quota problem before it is a
model problem. Three mechanisms, in the order a request meets them:

1. QUOTA DIET — the cheapest call is the one never made.
   - Quick-action buttons carry an explicit intent; the server takes it and
     skips classification. Only SQL-only intents are accepted from a client
     (ANALYTICS, TOPIC_ANALYTICS, TOPIC_WEIGHTAGE, YEAR_TREND), so a client
     can never name its way past the scope gate into a synthesis path.
   - Classification is regex/coerce-FIRST. The LLM classification lane is
     spent only when it buys something the regexes cannot: history to
     resolve a follow-up against, a query no rule matched, or a verdict
     that is synthesis-bound and therefore needs the LLM scope gate.

2. SHARED CACHE (Neon `response_cache`), checked BEFORE any provider call.
   Keyed on (subject, normalized_question, filters_hash). L1 is per-instance
   memory; L2 is Neon, so the first student to ask pays and every other
   instance reads it back free. Deterministic entries (analytics/weightage/
   trends) are valid only at the current `corpus_version` — a count is
   either currently true or wrong, which no TTL can express. LLM-written
   entries ride a long TTL (CACHE_TTL_SEMANTIC_DAYS, default 7). Cache
   failures degrade to "miss" and log: a broken cache costs quota, never
   answers.

3. TWO CALL-TYPE LANES, each an env-configurable provider ladder. Groq and
   OpenRouter are OpenAI-compatible and share ONE adapter.
   - classification: Groq -> Gemini -> regex-only. High volume, tiny JSON
     replies, wants the biggest requests-per-day ceiling.
   - synthesis: Gemini -> Groq -> OpenRouter -> degraded mode. The prose the
     student reads, so it leads with the best writer.
   Rules that hold across all of them:
   - Preflight on first use, via the provider's model catalogue, so a dead
     model costs no generation quota to discover. Verdict is sticky.
   - Same 429 handling everywhere: per-minute limits are a short cooldown
     (honoring Retry-After), daily limits bench the provider until the next
     UTC day. Gemini additionally rotates its N keys underneath.
   - A DEAD MODEL (404, or a rejected key) ABORTS THE LANE LOUDLY. It is a
     deploy bug, not a quota event, and must never masquerade as exhausted
     quota — the one failure mode that is never degraded silently.
   - Quality is a property of the ANSWER, not of a provider: the grounding,
     skip-safety, verdict-first, banned-phrase and citation-format contracts
     run against Groq and OpenRouter output too (tests/provider-contract).
   - OpenRouter's free tier is 50 model requests/DAY. It is a thin last
     resort, not a workhorse.

## Response invariants (enforced, all subjects)
- Scope fidelity: deliver what was asked at the asked scope; any
  capped/preview/filtered response states its actual scope in the answer.
  Silent truncation or substitution is forbidden.
- Denominator integrity: every "N of M" uses that subject's (and active
  filter's) true M; a count may never exceed its denominator; nested counts
  ("Questions (N)") are true DB totals, never preview lengths.
- Filter propagation: an extracted year/exam-type filter applies to
  whichever intent fires, with filtered denominators and a visible badge;
  filters modify scope, never intent.
- Skip safety: skip/deprioritize candidates only from the rarely-asked tail
  (<=3 exams, config); the "not skippable" statement for high-frequency
  topics is mandatory; a response naming a >3-exam topic as skippable is
  rejected and retried.
- Grounding: synthesis claims trace to retrieved data; below the similarity
  floor -> honest no-answer with topic suggestions; prediction phrasings
  lead with the cannot-predict disclaimer.
- Honest emptiness: zero-match and empty-filter results state the fact plus
  what does exist (available years, nearest topics) — never bluff, never a
  generic fallback without saying so.
- Small-corpus humility: below thresholds (<8 distinct exams or <100
  questions, config), suppress tiers/percentages, prepend a small-archive
  caveat, and refuse rising/fading labels with <3 distinct years.
- No internal vocabulary in any user-visible text.
These are enforced server-side by lib/invariants.ts on every /api/ask
response: deterministic-path violations are bugs (logged loudly as
invariant_violation and fixed at the source); LLM-path violations trigger
reject/retry, then degrade honestly.

## Quality gates (do not skip)
- After first 300 papers processed: script that samples 20 random papers and
  prints extracted questions next to the PDF URL for manual comparison.
- A /api/stats endpoint showing papers done/failed/pending, question counts
  per subject.
- Log every Gemini JSON parse failure; retry once with a repair prompt.

## Env vars / GitHub secrets
- DATABASE_URL (Neon)
- GEMINI_API_KEYS (comma-separated list of 1..N keys; may change at any
  time. ALL keys are shared by both the runtime app and the pipeline: the
  runtime rotates per request (random start per instance, cooldown on
  per-minute 429s, benched until the next UTC day on daily-quota 429s), and
  the pipeline rotates over the same set — it runs briefly on a schedule,
  so collisions are acceptable. The code must read this dynamically — never
  hardcode a key count anywhere; a single-key deployment must work.)
- GROQ_API_KEY, OPENROUTER_API_KEY (one key each, both optional). With only
  GEMINI_API_KEYS set the app behaves exactly as it did before the lanes
  existed.
- Lane order: CLASSIFICATION_PROVIDERS, SYNTHESIS_PROVIDERS (comma-separated
  provider names). Models: GROQ_CLASSIFICATION_MODEL, GROQ_SYNTHESIS_MODEL,
  OPENROUTER_CLASSIFICATION_MODEL, OPENROUTER_SYNTHESIS_MODEL,
  OPENROUTER_TIMEOUT_MS. Free catalogues change; a model id must be fixable
  with an env var, never a redeploy, and NEVER hardcoded outside its default.
- CACHE_TTL_SEMANTIC_DAYS (default 7) for LLM-written cache entries.
- Backend /api/ask degrades gracefully only when every provider in the lane
  is exhausted — and never for a dead model, which aborts loudly instead.

## Open source
This repo is public/open source. Therefore:
- NEVER commit keys, .env files, or connection strings. Ship a .env.example
  with placeholder values and add .env* to .gitignore from the first commit.
- Add a proper README (what it does, architecture diagram, how to self-host
  with your own free keys) and an MIT license.
- Contributors run the same pipeline with their own GEMINI_API_KEYS — nothing
  in the code may assume a specific number of keys (1..N must all work).
  