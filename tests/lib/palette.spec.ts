import { describe, expect, it } from "vitest";
import { PALETTES, getPalette } from "../../src/lib/palette";

describe("getPalette", () => {
  it("returns the named palette", () => {
    expect(getPalette("terrain").name).toBe("terrain");
    expect(getPalette("buildings").name).toBe("buildings");
  });

  it("throws for unknown palette names", () => {
    expect(() => getPalette("nope")).toThrow(/Unknown palette/);
  });
});

describe("PALETTES", () => {
  it("contains the four core palettes", () => {
    expect(Object.keys(PALETTES).sort()).toEqual(["buildings", "terrain", "ui", "units"]);
  });

  it("every palette has named colors", () => {
    for (const p of Object.values(PALETTES)) {
      expect(Object.keys(p.colors).length).toBeGreaterThan(0);
    }
  });
});
