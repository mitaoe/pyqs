import { Pool } from "pg";

/**
 * Shared Postgres (Neon) connection pool.
 *
 * Cached on globalThis so Next.js dev hot-reload and per-route module
 * instances reuse one pool instead of leaking connections. Keep `max` tiny:
 * every serverless instance gets its own pool and Neon's free tier caps
 * total connections (use the pooled "-pooler" DATABASE_URL on Vercel).
 */

const globalForDb = globalThis as unknown as { pyqPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.pyqPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.pyqPool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      // Generous: Neon free tier can queue connects under parallel load
      // (cold resume + many workers), and a slow connect beats a failure.
      connectionTimeoutMillis: 30_000,
    });
  }
  return globalForDb.pyqPool;
}

export async function closePool(): Promise<void> {
  if (globalForDb.pyqPool) {
    await globalForDb.pyqPool.end();
    globalForDb.pyqPool = undefined;
  }
}
