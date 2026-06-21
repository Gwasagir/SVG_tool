import { describe, expect, it } from "vitest";
import {
  _clearForTests,
  list,
  listByCategory,
  register,
  registerAll,
} from "../../src/lib/registry";
import type { AssetSpec } from "../../src/lib/types";

function makeSpec(id: string, category: AssetSpec["category"] = "ui"): AssetSpec {
  return { id, category, label: id, palette: "ui", build: () => ({ tag: "rect", attrs: {} }) };
}

describe("registry", () => {
  it("registers and looks up a spec", () => {
    _clearForTests();
    const s = makeSpec("ui/x");
    register(s);
    expect(list()).toContain("ui/x");
  });

  it("throws on duplicate registration", () => {
    _clearForTests();
    register(makeSpec("ui/x"));
    expect(() => register(makeSpec("ui/x"))).toThrow(/Duplicate asset id/);
  });

  it("registers many at once", () => {
    _clearForTests();
    registerAll([makeSpec("ui/a"), makeSpec("ui/b"), makeSpec("terrain/c", "terrain")]);
    expect(list().sort()).toEqual(["terrain/c", "ui/a", "ui/b"]);
  });

  it("filters by category", () => {
    _clearForTests();
    registerAll([
      makeSpec("ui/a"),
      makeSpec("terrain/b", "terrain"),
      makeSpec("terrain/c", "terrain"),
    ]);
    expect(listByCategory("terrain").sort()).toEqual(["terrain/b", "terrain/c"]);
    expect(listByCategory("ui")).toEqual(["ui/a"]);
  });

  it("clears for tests", () => {
    _clearForTests();
    expect(list()).toEqual([]);
  });
});
