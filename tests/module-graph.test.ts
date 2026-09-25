import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The embedding stack (@huggingface/transformers -> onnxruntime-node) loads a
 * native library as a side effect of being imported. Where that import sits in
 * the graph decides what happens on a runtime that lacks the library:
 *
 *   eager (`import x from "..."`)  -> the module fails while it is LOADING, so
 *                                     the route 500s before the handler runs
 *                                     and no try/catch can help.
 *   deferred (`await import("...")`) -> the failure surfaces at first use,
 *                                     where it is catchable and the route can
 *                                     degrade honestly.
 *   type-only (`import type ...`)   -> erased at compile time; not an edge.
 *
 * That is how /api/subjects, a pure SQL aggregation, started returning 500 in
 * production: it imported EXAM_KEY_SQL from analytics.ts, which imported
 * toVectorLiteral from embed.ts, which eagerly imported transformers. A type
 * error cannot catch that; only the shape of the graph can.
 */

const EMBEDDING_MODULES = ["@huggingface/transformers", "onnxruntime-node"];

/** Routes that must answer from SQL alone. */
const SQL_ONLY_ROUTES = [
  "src/app/api/subjects/route.ts",
  "src/app/api/stats/route.ts",
  "src/app/api/topic-questions/route.ts",
  "src/app/api/health/route.ts",
];

const ASK_ROUTE = "src/app/api/ask/route.ts";

type Edge = "eager" | "deferred";

function resolveSpec(spec: string, fromFile: string): string | null {
  if (EMBEDDING_MODULES.includes(spec)) return spec;
  let base: string | null = null;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(fromFile), spec));
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return normalize(candidate);
  }
  return null;
}

/** Runtime edges out of one file, tagged by how they load. Type-only imports are skipped. */
function edgesOf(file: string): { spec: string; kind: Edge }[] {
  const source = readFileSync(file, "utf8");
  const edges: { spec: string; kind: Edge }[] = [];
  // `import ... from "m"` / `import "m"` / `export ... from "m"`, excluding
  // `import type` and `export type`.
  for (const m of source.matchAll(/^\s*(?:import|export)(?!\s+type\s)([^;]*?)from\s+"([^"]+)"/gm)) {
    if (/^\s*\{?\s*type\s/.test(m[1])) continue; // import { type X } from "m"
    edges.push({ spec: m[2], kind: "eager" });
  }
  for (const m of source.matchAll(/^\s*import\s+"([^"]+)"/gm)) {
    edges.push({ spec: m[1], kind: "eager" });
  }
  for (const m of source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)) {
    edges.push({ spec: m[1], kind: "deferred" });
  }
  return edges;
}

/**
 * How the embedding stack is reached from `entry`, if at all. A path is only
 * "eager" when every hop on it is eager — one deferred hop defers the whole
 * chain.
 */
function reachEmbeddingStack(entry: string): Set<Edge> {
  const found = new Set<Edge>();
  const seen = new Set<string>();
  const queue: { file: string; kind: Edge }[] = [{ file: normalize(entry), kind: "eager" }];
  while (queue.length > 0) {
    const { file, kind } = queue.pop() as { file: string; kind: Edge };
    const key = `${file}:${kind}`;
    if (seen.has(key) || !existsSync(file)) continue;
    seen.add(key);
    for (const edge of edgesOf(file)) {
      const resolved = resolveSpec(edge.spec, file);
      if (!resolved) continue;
      const effective: Edge = kind === "deferred" || edge.kind === "deferred" ? "deferred" : "eager";
      if (EMBEDDING_MODULES.includes(resolved)) found.add(effective);
      else queue.push({ file: resolved, kind: effective });
    }
  }
  return found;
}

describe("nothing imports the embedding stack eagerly", () => {
  it.each(SQL_ONLY_ROUTES)("%s never reaches it, eagerly or lazily", (route) => {
    expect(existsSync(route)).toBe(true);
    expect([...reachEmbeddingStack(route)]).toEqual([]);
  });

  it("/api/ask reaches it — but only through a deferred import", () => {
    const reached = reachEmbeddingStack(ASK_ROUTE);
    // Present, so we know the walker really finds the stack (not a vacuous pass).
    expect([...reached]).toContain("deferred");
    // Absent, which is the actual fix: an eager edge here would 500 the whole
    // route on a runtime without the native library, analytics included.
    expect([...reached]).not.toContain("eager");
  });

  it("embed.ts loads transformers lazily and holds only a type import of it", () => {
    const edges = edgesOf("src/lib/rag/embed.ts").filter((e) =>
      EMBEDDING_MODULES.includes(e.spec),
    );
    expect(edges.map((e) => e.kind)).toEqual(["deferred"]);
  });
});

describe("the vector helpers stay dependency-free", () => {
  it("vector.ts imports nothing at all", () => {
    expect(readFileSync("src/lib/rag/vector.ts", "utf8").match(/^import\s/m)).toBeNull();
  });

  it("analytics.ts and search.ts take them from vector.ts, not embed.ts", () => {
    for (const f of ["src/lib/rag/analytics.ts", "src/lib/rag/search.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/from "\.\/embed"/);
    }
  });
});
