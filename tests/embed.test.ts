import { describe, expect, it } from "vitest";

import { embedQuery } from "../src/lib/rag/embed";
import { EMBED_DIM, toVectorLiteral } from "../src/lib/rag/vector";

// No DB needed: verifies the transformers.js path produces vectors shaped
// exactly like the pipeline's (384-dim, L2-normalized).
describe("embedQuery", () => {
  it("returns a normalized 384-dim vector", async () => {
    const vec = await embedQuery("Explain the two-phase commit protocol.");
    expect(vec).toHaveLength(EMBED_DIM);
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it("similar texts are closer than unrelated texts", async () => {
    const [a, b, c] = await Promise.all([
      embedQuery("Explain TCP congestion control."),
      embedQuery("Describe how TCP handles network congestion."),
      embedQuery("Derive the bending moment of a cantilever beam."),
    ]);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0);
    expect(dot(a, b)).toBeGreaterThan(dot(a, c));
  });

  it("formats a pgvector literal", () => {
    expect(toVectorLiteral([0.5, -1])).toBe("[0.500000,-1.000000]");
  });
});
