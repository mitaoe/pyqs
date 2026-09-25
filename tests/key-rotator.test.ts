import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AllKeysBenched,
  _resetKeyRotatorForTests,
  acquireKey,
  benchKey,
  benchKeyForDay,
  keyAvailability,
} from "../src/lib/rag/key-rotator";

const ORIGINAL = process.env.GEMINI_API_KEYS;

function setKeys(keys: string[]) {
  process.env.GEMINI_API_KEYS = keys.join(",");
  _resetKeyRotatorForTests();
}

describe("KeyRotator", () => {
  beforeEach(() => setKeys(["key-a", "key-b", "key-c"]));
  afterEach(() => {
    process.env.GEMINI_API_KEYS = ORIGINAL;
    _resetKeyRotatorForTests();
  });

  it("advances round-robin across calls, visiting every key evenly", () => {
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) seen.push(acquireKey().index);
    // random start, but two full cycles must hit each key exactly twice
    const counts = [0, 0, 0];
    for (const i of seen) counts[i]++;
    expect(counts).toEqual([2, 2, 2]);
    // and consecutive picks differ (advance-per-request)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it("skips benched keys and returns them after the cooldown", async () => {
    const first = acquireKey().index;
    benchKey(first, 80);
    for (let i = 0; i < 4; i++) expect(acquireKey().index).not.toBe(first);
    await new Promise((r) => setTimeout(r, 100));
    const indexes = new Set([acquireKey().index, acquireKey().index, acquireKey().index]);
    expect(indexes.has(first)).toBe(true); // back in rotation
  });

  it("daily bench lasts beyond any short window", () => {
    benchKeyForDay(0);
    for (let i = 0; i < 4; i++) expect(acquireKey().index).not.toBe(0);
    expect(keyAvailability()).toMatchObject({ total: 3, available: 2, benched: 1 });
  });

  it("throws AllKeysBenched only when every key is out", () => {
    benchKey(0, 60_000);
    benchKey(1, 60_000);
    expect(acquireKey().index).toBe(2); // last one still serves
    benchKey(2, 60_000);
    expect(() => acquireKey()).toThrow(AllKeysBenched);
  });

  it("single-key deployments work and bench sensibly", () => {
    setKeys(["only-key"]);
    expect(acquireKey().index).toBe(0);
    expect(acquireKey().index).toBe(0); // rotation over one key
    benchKey(0, 60_000);
    expect(() => acquireKey()).toThrow(AllKeysBenched);
    expect(keyAvailability()).toMatchObject({ total: 1, available: 0, benched: 1 });
  });

  it("reports availability for /api/health", () => {
    expect(keyAvailability()).toMatchObject({ total: 3, available: 3, benched: 0 });
  });
});
