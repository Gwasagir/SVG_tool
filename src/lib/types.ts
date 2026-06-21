// SVG tile library — public types.
// Assets are authored in a 0..100 viewBox and scaled at render time.

/** Allowed SVG element tags (whitelist enforced by the validator). */
export type SvgTag =
  | "svg"
  | "g"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "polyline"
  | "polygon"
  | "path"
  | "defs"
  | "linearGradient"
  | "radialGradient"
  | "stop"
  | "use"
  | "title"
  | "desc";

/** A node in the scene tree. Children are rendered in array order. */
export interface SvgNode {
  tag: SvgTag;
  attrs?: Record<string, string | number>;
  children?: SvgNode[];
  /** Text content for <title>/<desc>. Ignored for other tags. */
  text?: string;
}

/** A reusable palette — names map to hex colors. */
export interface Palette {
  name: string;
  colors: Record<string, string>;
}

/** Sizes we support (px). Assets are authored at 0..100 and scaled. */
export type TileSize = 32 | 64 | 128 | 256;

/** Asset categories. */
export type AssetCategory = "terrain" | "buildings" | "units" | "ui";

/** Common render options. */
export interface RenderOptions {
  size: TileSize;
  /** Optional palette override; defaults to the asset's declared palette. */
  palette?: Palette;
  /** Seed for any randomness (asset specs that use mulberry32). */
  seed?: number;
}

/** A declarative asset spec — a function that builds an SvgNode tree. */
export interface AssetSpec {
  /** Stable id: `<category>/<name>`. */
  id: string;
  category: AssetCategory;
  /** Human-readable label. */
  label: string;
  /** Default palette name. */
  palette: string;
  /**
   * Build the asset's scene tree in 0..100 coordinates.
   * Pure: same `ctx` → same tree. Read randomness from `ctx.rng`.
   */
  build: (ctx: BuildContext) => SvgNode;
}

/** Passed to `AssetSpec.build`. Provides palette colors and a seeded rng. */
export interface BuildContext {
  palette: Palette;
  rng: () => number;
}

/** Result of rendering an asset at a specific size. */
export interface RenderResult {
  svg: string;
  bytes: number;
  size: TileSize;
  id: string;
}
