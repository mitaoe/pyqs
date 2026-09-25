/**
 * Query-time embeddings for semantic search.
 *
 * The corpus was embedded by the pipeline with sentence-transformers
 * all-MiniLM-L6-v2 (384-dim, normalized). Cosine similarity is only
 * meaningful inside ONE embedding space, so the query MUST go through the
 * same model — a Gemini embedding would be a different space entirely.
 * sentence-transformers (PyTorch) can't run on Vercel serverless, so we run
 * the same model as quantized ONNX via transformers.js: ~23 MB, downloaded
 * on cold start and cached in /tmp (the only writable path on Vercel).
 *
 * Parity with the Python-side vectors is asserted by tests/semantic.integration.
 *
 * The library is imported LAZILY, never at module scope. Importing
 * @huggingface/transformers loads onnxruntime's native binding as a side
 * effect of the import itself, so on a runtime where that library is missing
 * the failure lands while the ROUTE MODULE is being loaded — before any
 * handler runs, where no try/catch can reach it, and /api/ask answers 500 even
 * for questions that never needed an embedding. Deferring it to first use
 * turns that into a catchable EmbeddingsUnavailable, so the deterministic
 * paths keep working and the semantic path degrades honestly.
 */

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

import { EMBED_DIM, EmbeddingsUnavailable } from "./vector";

// Same weights as sentence-transformers/all-MiniLM-L6-v2, converted to ONNX.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  const { pipeline, env } = await import("@huggingface/transformers");
  // /tmp is the only writable path on Vercel.
  env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR ?? "/tmp/transformers-cache";
  // transformers.js' overloaded pipeline() signature explodes into a union too
  // complex for tsc (TS2590); collapse it to the one call shape we use.
  const factory = pipeline as unknown as (
    task: "feature-extraction",
    model: string,
    options?: { dtype: string },
  ) => Promise<FeatureExtractionPipeline>;
  return factory("feature-extraction", MODEL_ID, { dtype: "q8" });
}

/**
 * One in-flight load is shared by every concurrent caller, and a successful
 * load is kept for the life of the instance. A FAILED load is not: memoizing
 * the rejection would turn one bad cold start (a network blip mid-download, a
 * half-written cache file) into a failure on every semantic query until the
 * instance is recycled. transformers.js deletes a partial download when it
 * errors, so the next call re-fetches cleanly.
 */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    const attempt = loadExtractor();
    extractorPromise = attempt;
    attempt.catch(() => {
      if (extractorPromise === attempt) extractorPromise = null;
    });
  }
  return extractorPromise;
}

/** First line only: these errors carry multi-line native stack noise. */
function reason(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n")[0].slice(0, 200);
}

export async function embedQuery(text: string): Promise<number[]> {
  let extractor: FeatureExtractionPipeline;
  try {
    extractor = await getExtractor();
  } catch (err) {
    throw new EmbeddingsUnavailable(`embedding model unavailable: ${reason(err)}`, { cause: err });
  }

  let vec: number[];
  try {
    // mean pooling + L2 normalize matches the pipeline's
    // encode(..., normalize_embeddings=True)
    const out = await extractor(text, { pooling: "mean", normalize: true });
    vec = Array.from(out.data as Float32Array);
  } catch (err) {
    throw new EmbeddingsUnavailable(`embedding failed: ${reason(err)}`, { cause: err });
  }

  // A wrong width means a different model, which means a different vector
  // space than the stored embeddings — never search with it.
  if (vec.length !== EMBED_DIM) {
    throw new EmbeddingsUnavailable(`expected ${EMBED_DIM}-dim embedding, got ${vec.length}`);
  }
  return vec;
}
