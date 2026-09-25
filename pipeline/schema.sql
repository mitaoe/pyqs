-- MITAoE PYQ Analytics + RAG — Postgres schema (Neon + pgvector).
-- Idempotent: safe to run on every pipeline start.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS papers (
    id               SERIAL PRIMARY KEY,
    file_name        TEXT NOT NULL,
    url              TEXT NOT NULL UNIQUE,
    year             TEXT,
    branch           TEXT,
    semester         TEXT,
    exam_type        TEXT,
    subject          TEXT,
    standard_subject TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',  -- pending | done | failed
    error            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    id            SERIAL PRIMARY KEY,
    paper_id      INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    marks         INTEGER,
    sub_label     TEXT,
    embedding     vector(384),
    cluster_id    INTEGER,
    has_figure    BOOLEAN,  -- refers to a provided figure/diagram (audit backfills)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing databases predate these columns.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS has_figure BOOLEAN;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS extract_method TEXT;  -- 'text' | 'ocr' (tracked going forward)

-- Per-subject corpus health, recomputed by pipeline/audit_subjects.py.
CREATE TABLE IF NOT EXISTS subject_stats (
    standard_subject     TEXT PRIMARY KEY,
    papers               INTEGER,
    exams                INTEGER,
    questions            INTEGER,
    clusters             INTEGER,
    pct_labeled          REAL,
    distinct_years       INTEGER,
    years                JSONB,      -- {year: paper_count}
    pct_ocr              REAL,       -- NULL where extract_method was never tracked
    pct_figure           REAL,
    max_cluster_size     INTEGER,
    max_cluster_texts    INTEGER,    -- distinct member texts of that largest cluster
    text_twin_risk       REAL,       -- share of clusters: near-identical text, >=3 exams, figure-dependent
    computed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clusters (
    id                  SERIAL PRIMARY KEY,
    standard_subject    TEXT NOT NULL,
    representative_text TEXT NOT NULL,
    question_count      INTEGER NOT NULL,
    papers_count        INTEGER NOT NULL,
    years_spanned       TEXT,
    topic               TEXT  -- canonical topic name assigned by label_topics.py
);

-- Existing databases predate the topic column.
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS topic TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_cluster ON questions (cluster_id);
CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions (paper_id);
CREATE INDEX IF NOT EXISTS idx_papers_subject_status ON papers (standard_subject, status);
CREATE INDEX IF NOT EXISTS idx_clusters_subject ON clusters (standard_subject);
CREATE INDEX IF NOT EXISTS idx_clusters_subject_topic ON clusters (standard_subject, topic);

-- ANN index for subject-filtered semantic search.
CREATE INDEX IF NOT EXISTS idx_questions_embedding
    ON questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Shared response cache ──────────────────────────────────────────────────
-- The night before an exam, thousands of students ask the same handful of
-- questions. Caching in Neon (not just per-instance memory) means the FIRST
-- student pays for an answer and every other student on every other
-- serverless instance reads it for free — the single biggest lever for
-- serving 15K requests/day on free tiers.

-- Monotonic counter bumped at the end of every ingest run. Deterministic
-- (SQL-derived) cache entries are valid only while it matches: new papers
-- change the counts, so those answers must not survive an ingest.
CREATE TABLE IF NOT EXISTS corpus_version (
    id         INTEGER PRIMARY KEY,
    version    BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT corpus_version_singleton CHECK (id = 1)
);
INSERT INTO corpus_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS response_cache (
    cache_key           TEXT PRIMARY KEY,   -- sha256(subject, normalized_question, filters_hash)
    subject             TEXT NOT NULL,
    normalized_question TEXT NOT NULL,
    filters_hash        TEXT NOT NULL,
    intent              TEXT,
    -- true  = answered from SQL; valid only at corpus_version below.
    -- false = LLM-written; valid until expires_at.
    deterministic       BOOLEAN NOT NULL,
    corpus_version      BIGINT NOT NULL,
    response            JSONB NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    hits                INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_response_cache_sweep
    ON response_cache (deterministic, corpus_version);
