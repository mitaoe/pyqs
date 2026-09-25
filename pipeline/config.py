"""Central configuration for the ingestion pipeline.

Tunables live here so behavior is changed in one place, never by editing
scripts. Secrets (DATABASE_URL, GEMINI_API_KEYS) come from the environment
only — see .env.example.
"""

import os

# --- Data source ---
PAPERS_API_URL = "https://mitaoe-pyqs.vercel.app/api/papers"
USER_AGENT = "mitaoe-pyq-rag ingestion bot (open source; polite: sequential downloads)"
DOWNLOAD_TIMEOUT_S = 120
DOWNLOAD_DELAY_S = 1.0        # politeness delay between PDF downloads (spec: <=2 concurrent)
MAX_PDF_BYTES = 40 * 1024 * 1024

# --- Text extraction ---
MIN_TEXT_CHARS = 100          # text layer shorter than this => scanned PDF => OCR fallback
OCR_DPI = 200

# --- Gemini (question extraction) ---
# Retired models report a free-tier limit of 0 (gemini-2.0-flash died this
# way). If extraction fails with "MODEL HAS NO FREE TIER" or "MODEL NOT
# FOUND", check this against the ListModels endpoint first.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_TIMEOUT_S = 120
GEMINI_CALL_DELAY_S = 2.0     # base sleep after every successful call (per-minute limits)
RATE_LIMIT_COOLDOWN_S = 60    # per-minute 429 => short cooldown for that key
QUOTA_COOLDOWN_S = 24 * 3600  # daily quota exhausted => key is out for this run
MAX_PROMPT_CHARS = 60_000     # exam papers are short; hard cap for safety
MIN_QUESTION_CHARS = 10       # drop extraction artifacts shorter than this
MAX_QUESTION_CHARS = 4_000

# --- Ingestion ---
DEFAULT_BATCH_LIMIT = 300     # papers per pipeline run

# --- Embeddings ---
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384
EMBED_BATCH_SIZE = 256        # questions fetched/updated per DB round-trip

# --- Clustering ---
CLUSTER_COSINE_THRESHOLD = 0.80   # similarity >= this => same cluster
MAX_CLUSTER_SUBJECT_SIZE = 12_000 # agglomerative is O(n^2); guard runner memory

# Formula/figure-heavy subjects merge distinct questions at 0.80 (audit:
# high text-twin risk) — cluster them stricter. audit_subjects.py ranks the
# candidates; additions here take effect on the next recluster of the subject.
CLUSTER_THRESHOLD_OVERRIDES = {
    "Network Analysis Techniques": 0.88,
    "Structural Analysis": 0.88,
    "Solid Mechanics": 0.88,
}

# --- Topic labeling ---
TOPIC_LABEL_BATCH = 40            # clusters labeled per Gemini call
TOPIC_MERGE_THRESHOLD = 0.85      # label-embedding similarity >= this => same topic
MAX_TOPIC_CHARS = 80
