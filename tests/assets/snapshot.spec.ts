// Snapshot tests for all seeded assets. Regenerate with: vitest run -u
import { describe, expect, it } from "vitest";
import "../../src/assets/index.js"; // registers all assets
import { list } from "../../src/lib/registry";
import { render } from "../../src/lib/renderer";

describe("seeded assets snapshot", () => {
  const ids = list();
  if (ids.length === 0) throw new Error("No assets registered — did you import the assets barrel?");

  for (const id of ids) {
    it(`renders ${id} at 128px deterministically`, () => {
      const result = render(id, { size: 128, seed: 1 });
      // Snapshot the full SVG string. If the asset changes intentionally,
      // update with: vitest run -u tests/assets/snapshot.spec.ts
      expect(result.svg).toMatchSnapshot();
    });
  }
});

describe("asset determinism", () => {
  it("produces identical output for the same seed across all assets", () => {
    for (const id of list()) {
      const a = render(id, { size: 64, seed: 42 });
      const b = render(id, { size: 64, seed: 42 });
      expect(a.svg).toBe(b.svg);
    }
  });

  it("produces valid SVG (renderer validates internally) for every asset at every size", () => {
    const sizes = [32, 64, 128, 256] as const;
    for (const id of list()) {
      for (const size of sizes) {
        expect(() => render(id, { size, seed: 0 })).not.toThrow();
      }
    }
  });
});
