import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../src/lib/rag/db";
import { CORPUS_VERSION_WRITE, REFUSAL } from "./live-db-guard";

const hasDb = Boolean(process.env.DATABASE_URL);

describe("which statements count as writing corpus_version", () => {
  it.each([
    "UPDATE corpus_version SET version = version + 1 WHERE id = 1",
    "update corpus_version set version = $1 where id = 1",
    "UPDATE public.corpus_version SET version = 2",
    'UPDATE "corpus_version" SET version = 2',
    "INSERT INTO corpus_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING",
    "DELETE FROM corpus_version",
    "TRUNCATE corpus_version",
    "TRUNCATE TABLE corpus_version",
    "DROP TABLE IF EXISTS corpus_version",
  ])("refuses: %s", (sql) => expect(CORPUS_VERSION_WRITE.test(sql)).toBe(true));

  it.each([
    "SELECT version FROM corpus_version WHERE id = 1",
    "SELECT count(*) FROM response_cache r, corpus_version v WHERE r.corpus_version > v.version",
    "INSERT INTO response_cache (cache_key, corpus_version) VALUES ($1, $2)",
    "UPDATE response_cache SET hits = hits + 1 WHERE corpus_version = $2",
    "UPDATE corpus_version_audit SET note = 'x'",
  ])("allows: %s", (sql) => expect(CORPUS_VERSION_WRITE.test(sql)).toBe(false));
});

describe("the guard is installed for every test file (tests/setup.ts)", () => {
  // Never connected: a refusal proves the guard answered, not the server.
  const client = () => new pg.Client({ connectionString: "postgres://guard@127.0.0.1:9/none" });

  it("promise-style writes are rejected before any connection", async () => {
    await expect(
      client().query("UPDATE corpus_version SET version = version + 1 WHERE id = 1"),
    ).rejects.toThrow(REFUSAL);
  });

  it("callback-style writes get the error through the callback", async () => {
    const err = await new Promise<Error | null>((resolve) => {
      client().query("DELETE FROM corpus_version", (e: Error | null) => resolve(e));
    });
    expect(err?.message).toBe(REFUSAL);
  });

  it("query-config objects are checked too", async () => {
    await expect(
      client().query({ text: "UPDATE corpus_version SET version = 9", values: [] }),
    ).rejects.toThrow(REFUSAL);
  });
});

describe.skipIf(!hasDb)("through the app's own pool (live DB)", () => {
  afterAll(() => closePool());

  // A no-op write: if the guard ever failed open, the database would run it
  // and change nothing — the assertion fails, production does not.
  it("refuses a write issued via getPool()", async () => {
    await expect(
      getPool().query("UPDATE corpus_version SET version = version WHERE id = 1"),
    ).rejects.toThrow(REFUSAL);
  });

  it("still lets reads through", async () => {
    const res = await getPool().query("SELECT version FROM corpus_version WHERE id = 1");
    expect(Number(res.rows[0].version)).toBeGreaterThan(0);
  });
});
