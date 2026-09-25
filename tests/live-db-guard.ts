import pg from "pg";

/**
 * The suite runs against the LIVE Neon database, and corpus_version is the
 * production cache's freshness signal. A test that moves it, even for a
 * moment, lets live instances stamp cache rows with a version the corpus is
 * not at, and those rows come back as valid at the next real bump. That
 * happened twice. Only the ingest pipeline may write it; from a test process
 * any write is refused before it reaches the database. To simulate a bump,
 * pin the version in-process with _pinCorpusVersionForTests().
 */
export const CORPUS_VERSION_WRITE =
  /\b(?:update|insert\s+into|delete\s+from|truncate(?:\s+table)?|alter\s+table|drop\s+table(?:\s+if\s+exists)?)\s+(?:only\s+)?(?:"?public"?\.)?"?corpus_version"?(?![\w"])/i;

export const REFUSAL =
  "refused: tests must never write the live corpus_version — pin it in-process with _pinCorpusVersionForTests()";

type QueryFn = (...args: unknown[]) => unknown;
const INSTALLED = Symbol.for("pyq.liveDbGuard");

/** Wraps pg's Client.query (every Pool query goes through it). Idempotent. */
export function installLiveDbGuard(): void {
  const proto = pg.Client.prototype as unknown as { query: QueryFn; [INSTALLED]?: true };
  if (proto[INSTALLED]) return;
  const original = proto.query;
  proto.query = function guardedQuery(this: pg.Client, ...args: unknown[]) {
    const first = args[0];
    const text = typeof first === "string" ? first : (first as { text?: unknown } | null)?.text;
    if (typeof text === "string" && CORPUS_VERSION_WRITE.test(text)) {
      const err = new Error(REFUSAL);
      // Honor pg's contract: callback style gets the error, promise style a rejection.
      const last = args[args.length - 1];
      if (typeof last === "function") {
        process.nextTick(last as (e: Error) => void, err);
        return undefined;
      }
      return Promise.reject(err);
    }
    return original.apply(this, args);
  };
  proto[INSTALLED] = true;
}
