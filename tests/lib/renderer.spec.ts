import { describe, expect, it } from "vitest";
import { getPalette } from "../../src/lib/palette";
import { rect } from "../../src/lib/primitives";
import { _clearForTests, register } from "../../src/lib/registry";
import { render, serialize } from "../../src/lib/renderer";
import { mulberry32 } from "../../src/lib/rng";
import type { AssetSpec } from "../../src/lib/types";

describe("serialize", () => {
  it("produces a self-closing tag for childless nodes", () => {
    const out = serialize({ tag: "rect", attrs: { width: 10, height: 10, fill: "#000" } });
    expect(out).toContain("<rect");
    expect(out).toContain("/>");
  });

  it("escapes attribute values", () => {
    const out = serialize({ tag: "rect", attrs: { fill: 'a"b' } });
    expect(out).toContain("&quot;");
  });
});

describe("render", () => {
  it("throws for unknown asset ids", () => {
    _clearForTests();
    expect(() => render("nope/missing", { size: 64 })).toThrow(/Unknown asset id/);
  });

  it("renders a registered asset and wraps in <svg>", () => {
    _clearForTests();
    const spec: AssetSpec = {
      id: "test/rect",
      category: "ui",
      label: "Test",
      palette: "ui",
      build: () => rect(0, 0, 100, 100, "#000"),
    };
    register(spec);
    const result = render("test/rect", { size: 64 });
    expect(result.size).toBe(64);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain('width="64"');
    expect(result.svg).toContain('viewBox="0 0 100 100"');
  });

  it("uses a provided palette override", () => {
    _clearForTests();
    const spec: AssetSpec = {
      id: "test/palette",
      category: "ui",
      label: "T",
      palette: "ui",
      build: (ctx) => rect(0, 0, 10, 10, ctx.palette.colors.frame),
    };
    register(spec);
    const result = render("test/palette", { size: 32, palette: getPalette("ui") });
    expect(result.svg).toContain("#5a4a3a");
  });

  it("is deterministic for a fixed seed", () => {
    _clearForTests();
    const spec: AssetSpec = {
      id: "test/rand",
      category: "ui",
      label: "T",
      palette: "ui",
      build: (ctx) => rect(0, 0, Math.floor(ctx.rng() * 100), 10, "#000"),
    };
    register(spec);
    const a = render("test/rand", { size: 64, seed: 7 });
    const b = render("test/rand", { size: 64, seed: 7 });
    expect(a.svg).toBe(b.svg);
  });

  it("throws if the spec produces invalid SVG", () => {
    _clearForTests();
    const spec: AssetSpec = {
      id: "test/bad",
      category: "ui",
      label: "T",
      palette: "ui",
      build: () => ({ tag: "rect", attrs: { onclick: "x" } }),
    };
    register(spec);
    expect(() => render("test/bad", { size: 64 })).toThrow(/invalid SVG/);
  });
});
