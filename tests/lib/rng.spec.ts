import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "../../src/lib/rng";

describe("mulberry32", () => {
  it("produces deterministic values for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles edge case seed 0", () => {
    const r = mulberry32(0);
    expect(r()).toBeGreaterThanOrEqual(0);
    expect(r()).toBeLessThan(1);
  });
});

describe("hashString", () => {
  it("returns the same hash for the same string", () => {
    expect(hashString("archer")).toEqual(hashString("archer"));
  });

  it("returns different hashes for different strings", () => {
    expect(hashString("archer")).not.toEqual(hashString("knight"));
  });

  it("returns a 32-bit unsigned int", () => {
    const h = hashString("test");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
