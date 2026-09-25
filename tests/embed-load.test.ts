import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Model-load lifecycle of the query embedder, with transformers.js stubbed so
 * a failed load can be produced on demand (the real one fails only on a cold
 * start that goes wrong — see the live repro in the commit message).
 */

const pipelineMock = vi.hoisted(() => vi.fn());
vi.mock("@huggingface/transformers", () => ({ pipeline: pipelineMock, env: {} }));

const DIM = 384;
const fakeExtractor = async () => ({ data: new Float32Array(DIM).fill(1 / Math.sqrt(DIM)) });

/** A fresh module per test: the extractor is module state. */
async function freshEmbed() {
  vi.resetModules();
  return import("../src/lib/rag/embed");
}

beforeEach(() => {
  pipelineMock.mockReset();
});

describe("embedQuery model loading", () => {
  it("does not memoize a failed load — the next call retries", async () => {
    pipelineMock
      .mockRejectedValueOnce(new Error("Protobuf parsing failed."))
      .mockResolvedValueOnce(fakeExtractor);
    const { embedQuery } = await freshEmbed();

    await expect(embedQuery("what is paging")).rejects.toThrow(/Protobuf/);
    await expect(embedQuery("what is paging")).resolves.toHaveLength(DIM);
    expect(pipelineMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one in-flight load", async () => {
    pipelineMock.mockResolvedValue(fakeExtractor);
    const { embedQuery } = await freshEmbed();

    await Promise.all([embedQuery("a"), embedQuery("b"), embedQuery("c")]);
    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });

  it("concurrent callers of a failing load all see the failure, then one retry recovers", async () => {
    pipelineMock
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(fakeExtractor);
    const { embedQuery } = await freshEmbed();

    const results = await Promise.allSettled([embedQuery("a"), embedQuery("b")]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(pipelineMock).toHaveBeenCalledTimes(1);

    await expect(embedQuery("a")).resolves.toHaveLength(DIM);
    expect(pipelineMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a successful load for the life of the instance", async () => {
    pipelineMock.mockResolvedValue(fakeExtractor);
    const { embedQuery } = await freshEmbed();

    await embedQuery("a");
    await embedQuery("b");
    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });
});
