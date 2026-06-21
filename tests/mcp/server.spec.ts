/**
 * Tests for the SVG_tool MCP server.
 *
 * These tests exercise the tool handlers directly via the exported
 * `toolHandlers` map — each handler mirrors the schema/behavior registered
 * with `server.tool(...)`, but is callable in isolation (no stdio transport).
 * This avoids spawning a real MCP client and keeps the tests deterministic.
 *
 * The `svg_generate` tool is mocked: we stub the `generate` function from
 * `src/generator` so the test never makes a network call.
 */
import { describe, expect, it, beforeEach } from "vitest";

// Register all assets (side-effectful import).
import "../../src/assets";

import { toolHandlers, SERVER_INFO, __setGenerateImpl } from "../../src/mcp/server";
import { _clearForTests, register } from "../../src/lib/registry";
import type { AssetSpec } from "../../src/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECT_ASSET: AssetSpec = {
  id: "test/rect",
  category: "ui",
  label: "Test rect",
  palette: "ui",
  build: () => ({ tag: "rect", attrs: { x: 0, y: 0, width: 10, height: 10, fill: "#000" } }),
};

// ---------------------------------------------------------------------------
// Server metadata
// ---------------------------------------------------------------------------

describe("SERVER_INFO", () => {
  it("exposes a stable name and version", () => {
    expect(SERVER_INFO.name).toBe("svg-tool");
    expect(SERVER_INFO.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// Tool registration surface
// ---------------------------------------------------------------------------

describe("toolHandlers surface", () => {
  it("registers the five svg_* tools", () => {
    const names = Object.keys(toolHandlers).sort();
    expect(names).toEqual([
      "svg_generate",
      "svg_list",
      "svg_palettes",
      "svg_render",
      "svg_validate",
    ]);
  });
});

// ---------------------------------------------------------------------------
// svg_list
// ---------------------------------------------------------------------------

describe("svg_list", () => {
  it("returns all registered asset ids when no category given", async () => {
    _clearForTests();
    register(RECT_ASSET);
    const res = await toolHandlers.svg_list({});
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.ids).toContain("test/rect");
  });

  it("filters by category", async () => {
    _clearForTests();
    register(RECT_ASSET);
    register({ ...RECT_ASSET, id: "test/other", category: "terrain" });
    const res = await toolHandlers.svg_list({ category: "terrain" });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.ids).toEqual(["test/other"]);
  });

  it("returns an empty list for an unknown category", async () => {
    const res = await toolHandlers.svg_list({ category: "bogus" as never });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.ids).toEqual([]);
    expect(payload.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// svg_render
// ---------------------------------------------------------------------------

describe("svg_render", () => {
  beforeEach(() => {
    _clearForTests();
    register(RECT_ASSET);
  });

  it("renders a known asset to SVG bytes", async () => {
    const res = await toolHandlers.svg_render({ id: "test/rect", size: 64 });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.size).toBe(64);
    expect(payload.bytes).toBeGreaterThan(0);
    expect(payload.svg).toContain("<svg");
    expect(payload.svg).toContain('width="64"');
  });

  it("accepts all supported sizes", async () => {
    for (const size of [32, 64, 128, 256] as const) {
      const res = await toolHandlers.svg_render({ id: "test/rect", size });
      const payload = JSON.parse(res.content[0]?.text ?? "{}");
      expect(payload.size).toBe(size);
    }
  });

  it("is deterministic for the same seed", async () => {
    const a = await toolHandlers.svg_render({ id: "test/rect", size: 64, seed: 7 });
    const b = await toolHandlers.svg_render({ id: "test/rect", size: 64, seed: 7 });
    expect(a.content[0]?.text).toBe(b.content[0]?.text);
  });

  it("returns isError for an unknown id", async () => {
    const res = await toolHandlers.svg_render({ id: "nope/missing", size: 64 });
    expect(res.isError).toBe(true);
  });

  it("returns isError for an invalid size", async () => {
    const res = await toolHandlers.svg_render({ id: "test/rect", size: 999 as never });
    expect(res.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// svg_palettes
// ---------------------------------------------------------------------------

describe("svg_palettes", () => {
  it("lists all palette names with their color maps", async () => {
    const res = await toolHandlers.svg_palettes({});
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(Object.keys(payload.palettes).sort()).toEqual(["buildings", "terrain", "ui", "units"]);
    expect(payload.palettes.terrain.colors.grass).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("returns a single palette when name given", async () => {
    const res = await toolHandlers.svg_palettes({ name: "terrain" });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(Object.keys(payload.palettes)).toEqual(["terrain"]);
  });

  it("returns isError for an unknown palette name", async () => {
    const res = await toolHandlers.svg_palettes({ name: "bogus" });
    expect(res.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// svg_validate
// ---------------------------------------------------------------------------

describe("svg_validate", () => {
  it("accepts a valid minimal SVG", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10" fill="#000"/></svg>';
    const res = await toolHandlers.svg_validate({ svg });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.valid).toBe(true);
    expect(payload.errors).toEqual([]);
  });

  it("rejects an SVG with a disallowed tag", async () => {
    const svg = "<svg><script>alert(1)</script></svg>";
    const res = await toolHandlers.svg_validate({ svg });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.valid).toBe(false);
    expect(payload.errors.length).toBeGreaterThan(0);
  });

  it("rejects an SVG with an event handler attribute", async () => {
    const svg = '<svg><rect onclick="x" width="10" height="10"/></svg>';
    const res = await toolHandlers.svg_validate({ svg });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.valid).toBe(false);
  });

  it("returns valid:false for unparseable input", async () => {
    const res = await toolHandlers.svg_validate({ svg: "not svg at all" });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.valid).toBe(false);
    expect(res.isError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// svg_generate (mocked — no real LLM call)
// ---------------------------------------------------------------------------

describe("svg_generate", () => {
  beforeEach(() => {
    _clearForTests();
    register(RECT_ASSET);
  });

  it("returns generated SVG bytes and metadata on success", async () => {
    const fakeSvg =
      '<svg width="128" height="128" viewBox="0 0 100 100"><rect width="10" height="10" fill="#6abe30"/></svg>';
    __setGenerateImpl(async () => ({
      svg: fakeSvg,
      category: "terrain",
      size: 128,
      seed: 12345,
      attempts: 1,
      validation: { valid: true, errors: [] },
    }));

    const res = await toolHandlers.svg_generate({ prompt: "a grass tile", size: 128 });
    const payload = JSON.parse(res.content[0]?.text ?? "{}");
    expect(payload.svg).toBe(fakeSvg);
    expect(payload.category).toBe("terrain");
    expect(payload.size).toBe(128);
    expect(payload.attempts).toBe(1);
  });

  it("returns isError when the generator throws", async () => {
    __setGenerateImpl(async () => {
      throw new Error("LLM down");
    });
    const res = await toolHandlers.svg_generate({ prompt: "x", size: 128 });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("LLM down");
  });

  it("defaults size to 128 when omitted", async () => {
    let observed: number | undefined;
    __setGenerateImpl(async (opts) => {
      observed = opts.size;
      return {
        svg: "<svg/>",
        category: "terrain",
        size: opts.size ?? 128,
        seed: 1,
        attempts: 1,
        validation: { valid: true, errors: [] },
      };
    });
    await toolHandlers.svg_generate({ prompt: "anything" });
    expect(observed).toBe(128);
  });
});
