/**
 * svg-tool MCP server — exposes the SVG tile library + AI generator as MCP
 * tools so Claude Code and Opencode can render, list, validate, and generate
 * SVG tiles from any session that registers this server.
 *
 * Tools:
 *   svg_list      — list registered asset ids, optionally filtered by category
 *   svg_render    — render a known asset to SVG bytes at a given size
 *   svg_generate  — AI-generate an SVG from a free-text prompt (calls the LLM)
 *   svg_palettes  — list palettes and their named colors
 *   svg_validate  — validate an arbitrary SVG string against the whitelist
 *
 * The tool handlers are exported as `toolHandlers` so tests can call them
 * directly without spawning the stdio transport. The live server registers
 * the same handlers via `server.tool(...)` in `registerTools()`.
 *
 * `svg_generate` reaches the LLM through a swappable implementation seam
 * (`__generateImpl` / `__setGenerateImpl`). The default uses the real
 * `generate()` from `src/generator`; tests swap it for a stub.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PALETTES, getPalette } from "../lib/palette.js";
import { list, listByCategory } from "../lib/registry.js";
import { render } from "../lib/renderer.js";
import type { AssetCategory, TileSize } from "../lib/types.js";
import { validate } from "../lib/validate.js";
import {
  generate as realGenerate,
  parseSvg,
  type GenerateOptions,
  type GenerateResult,
} from "../generator/index.js";

// Register all built-in assets (side-effectful import — populates the registry
// so svg_list / svg_render see terrain/buildings/units/ui assets at startup).
import "../assets/index.js";

// ---------------------------------------------------------------------------
// Server metadata
// ---------------------------------------------------------------------------

export const SERVER_INFO = {
  name: "svg-tool",
  version: "0.1.0",
} as const;

export const server = new McpServer({
  name: SERVER_INFO.name,
  version: SERVER_INFO.version,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single MCP content block (text-only — SVG output is text). */
interface McpContent {
  type: "text";
  text: string;
}

/** The return shape every tool handler uses. Mirrors the MCP SDK contract:
 * the SDK expects an index signature so extra fields (_meta, etc.) are allowed. */
export interface ToolResult {
  [x: string]: unknown;
  content: McpContent[];
  isError?: boolean;
}

/** Build a successful ToolResult with JSON payload. */
function okJson(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

/** Build an error ToolResult. isError=true tells the host the tool failed. */
function errJson(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CATEGORIES = ["terrain", "buildings", "units", "ui"] as const;
const SIZES = [32, 64, 128, 256] as const;

const SvgListSchema = {
  category: z.enum(CATEGORIES).optional().describe("Filter by category. Omit to list all assets."),
};

const SvgRenderSchema = {
  id: z.string().describe("Asset id, e.g. 'terrain/grass'."),
  size: z
    .union([z.literal(32), z.literal(64), z.literal(128), z.literal(256)])
    .describe("Tile size in pixels. One of 32, 64, 128, 256."),
  seed: z.number().int().optional().describe("Seed for deterministic randomness (default 0)."),
};

const SvgGenerateSchema = {
  prompt: z.string().describe("Free-text prompt describing the desired tile."),
  category: z
    .enum(CATEGORIES)
    .optional()
    .describe("Asset category; inferred from prompt if omitted."),
  size: z
    .union([z.literal(32), z.literal(64), z.literal(128), z.literal(256)])
    .optional()
    .describe("Tile size in pixels (default 128)."),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Seed for deterministic output; derived from prompt if omitted."),
  palette: z
    .string()
    .optional()
    .describe("Palette name (e.g. 'terrain', 'buildings'). Defaults to category."),
  baseUrl: z.string().optional().describe("Override the LLM endpoint (OpenAI-compatible /v1)."),
  apiKey: z.string().optional().describe("Override the LLM API key."),
  model: z.string().optional().describe("Override the LLM model id."),
};

const SvgPalettesSchema = {
  name: z.string().optional().describe("Return only this palette; omit to list all."),
};

const SvgValidateSchema = {
  svg: z.string().describe("SVG markup to validate against the whitelist."),
};

// ---------------------------------------------------------------------------
// Generate implementation seam
// ---------------------------------------------------------------------------

type GenerateImpl = (opts: GenerateOptions) => Promise<GenerateResult>;

let __generateImpl: GenerateImpl = realGenerate;

/**
 * Replace the `generate` implementation. Test-only seam — lets the suite
 * exercise svg_generate without making a real LLM call.
 */
export function __setGenerateImpl(impl: GenerateImpl): void {
  __generateImpl = impl;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleSvgList(args: {
  category?: AssetCategory;
}): Promise<ToolResult> {
  try {
    if (args.category !== undefined) {
      const ids = listByCategory(args.category);
      return okJson({ category: args.category, ids, count: ids.length });
    }
    const ids = list();
    return okJson({ ids, count: ids.length });
  } catch (err) {
    return errJson(`svg_list failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleSvgRender(args: {
  id: string;
  size: TileSize;
  seed?: number;
}): Promise<ToolResult> {
  const VALID_SIZES: ReadonlyArray<number> = [32, 64, 128, 256];
  if (!VALID_SIZES.includes(args.size)) {
    return errJson(
      `svg_render failed: invalid size ${args.size}. Allowed: ${VALID_SIZES.join(", ")}`,
    );
  }
  try {
    const result = render(args.id, {
      size: args.size,
      seed: args.seed ?? 0,
    });
    return okJson({
      id: result.id,
      size: result.size,
      bytes: result.bytes,
      svg: result.svg,
    });
  } catch (err) {
    return errJson(`svg_render failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleSvgGenerate(args: {
  prompt: string;
  category?: AssetCategory;
  size?: TileSize;
  seed?: number;
  palette?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<ToolResult> {
  try {
    const opts: GenerateOptions = { prompt: args.prompt, size: args.size ?? 128 };
    if (args.category !== undefined) opts.category = args.category;
    if (args.seed !== undefined) opts.seed = args.seed;
    if (args.palette !== undefined) opts.palette = args.palette;
    if (args.baseUrl !== undefined) opts.baseUrl = args.baseUrl;
    if (args.apiKey !== undefined) opts.apiKey = args.apiKey;
    if (args.model !== undefined) opts.model = args.model;

    const result = await __generateImpl(opts);
    return okJson({
      svg: result.svg,
      category: result.category,
      size: result.size,
      seed: result.seed,
      attempts: result.attempts,
      valid: result.validation.valid,
    });
  } catch (err) {
    return errJson(`svg_generate failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleSvgPalettes(args: {
  name?: string;
}): Promise<ToolResult> {
  try {
    if (args.name !== undefined) {
      const p = getPalette(args.name);
      return okJson({ palettes: { [p.name]: { name: p.name, colors: p.colors } } });
    }
    const palettes: Record<string, { name: string; colors: Record<string, string> }> = {};
    for (const [key, p] of Object.entries(PALETTES)) {
      palettes[key] = { name: p.name, colors: p.colors };
    }
    return okJson({ palettes });
  } catch (err) {
    return errJson(`svg_palettes failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleSvgValidate(args: { svg: string }): Promise<ToolResult> {
  try {
    const tree = parseSvg(args.svg);
    if (!tree) {
      // An unparseable SVG is a validation failure, not a tool failure.
      // The parser rejects malformed XML (e.g. <script>alert(1)</script>
      // has text between tags that the lenient parser treats as a title
      // child but then fails to close). Report it as invalid with a clear
      // error so the caller can fix the markup.
      return okJson({
        valid: false,
        errors: [
          {
            path: "svg",
            message: "Input is not a parseable SVG document (malformed XML or unsupported syntax).",
          },
        ],
      });
    }
    const result = validate(tree);
    return okJson({
      valid: result.valid,
      errors: result.errors,
    });
  } catch (err) {
    return errJson(`svg_validate failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Test surface — call handlers directly without spawning the transport.
// ---------------------------------------------------------------------------

export const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> =
  {
    svg_list: (args: Record<string, unknown>) =>
      handleSvgList(args as { category?: AssetCategory }),
    svg_render: (args: Record<string, unknown>) =>
      handleSvgRender(args as { id: string; size: TileSize; seed?: number }),
    svg_generate: (args: Record<string, unknown>) =>
      handleSvgGenerate(
        args as {
          prompt: string;
          category?: AssetCategory;
          size?: TileSize;
          seed?: number;
          palette?: string;
          baseUrl?: string;
          apiKey?: string;
          model?: string;
        },
      ),
    svg_palettes: (args: Record<string, unknown>) => handleSvgPalettes(args as { name?: string }),
    svg_validate: (args: Record<string, unknown>) => handleSvgValidate(args as { svg: string }),
  };

// ---------------------------------------------------------------------------
// Register tools with the live McpServer instance.
// ---------------------------------------------------------------------------

export function registerTools(): void {
  server.tool(
    "svg_list",
    "List registered SVG tile asset ids. Pass `category` to filter (terrain|buildings|units|ui).",
    SvgListSchema,
    (args) => handleSvgList(args as { category?: AssetCategory }),
  );

  server.tool(
    "svg_render",
    "Render a known SVG tile asset by id at a given pixel size. Deterministic for the same seed.",
    SvgRenderSchema,
    (args) => handleSvgRender(args as { id: string; size: TileSize; seed?: number }),
  );

  server.tool(
    "svg_generate",
    "AI-generate an SVG tile from a free-text prompt via an OpenAI-compatible LLM endpoint. Returns the SVG markup plus metadata (category, size, seed, attempts).",
    SvgGenerateSchema,
    (args) =>
      handleSvgGenerate(
        args as {
          prompt: string;
          category?: AssetCategory;
          size?: TileSize;
          seed?: number;
          palette?: string;
          baseUrl?: string;
          apiKey?: string;
          model?: string;
        },
      ),
  );

  server.tool(
    "svg_palettes",
    "List all palettes (terrain, buildings, units, ui) and their named colors as hex, or return a single palette when `name` is given.",
    SvgPalettesSchema,
    (args) => handleSvgPalettes(args as { name?: string }),
  );

  server.tool(
    "svg_validate",
    "Validate an SVG string against the whitelist (no script, no event handlers, no remote refs). Returns { valid, errors }.",
    SvgValidateSchema,
    (args) => handleSvgValidate(args as { svg: string }),
  );
}

// Auto-register on import so the stdio entry in `main.ts` only needs to connect.
registerTools();
