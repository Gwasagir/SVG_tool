// SVG renderer — takes an AssetSpec + RenderOptions, produces a string.
// Assets are authored in a 0..100 viewBox; the renderer scales to the
// requested px size. Runs the validator before returning.

import { getPalette } from "./palette";
import { get as getSpec } from "./registry";
import { mulberry32 } from "./rng";
import type { AssetSpec, BuildContext, RenderOptions, RenderResult, SvgNode } from "./types";
import { validate } from "./validate";

/** Render an asset by id at a given size. Throws if unknown or invalid. */
export function render(id: string, opts: RenderOptions): RenderResult {
  const spec = getSpec(id);
  if (!spec) throw new Error(`Unknown asset id: ${id}`);
  return renderSpec(spec, opts);
}

/** Render an already-resolved spec. Useful for testing. */
export function renderSpec(spec: AssetSpec, opts: RenderOptions): RenderResult {
  const palette = opts.palette ?? getPalette(spec.palette);
  const seed = opts.seed ?? 0;
  const ctx: BuildContext = { palette, rng: mulberry32(seed) };
  const inner = spec.build(ctx);
  const tree = wrapRoot(inner, opts.size);
  const result = validate(tree);
  if (!result.valid) {
    throw new Error(
      `Asset ${spec.id} produced invalid SVG:\n${result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`,
    );
  }
  const svg = serialize(tree);
  return { svg, bytes: svg.length, size: opts.size, id: spec.id };
}

function wrapRoot(inner: SvgNode, size: RenderOptions["size"]): SvgNode {
  return {
    tag: "svg",
    attrs: {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 100 100",
    },
    children: [inner],
  };
}

/**
 * Serialize an SvgNode tree to an SVG string. Deterministic: attributes are
 * emitted in insertion order; children in array order. No comments, no
 * whitespace between tags (kept compact).
 */
export function serialize(node: SvgNode): string {
  return ser(node, "");
}

function ser(node: SvgNode, indent: string): string {
  if (node.tag === "title" || node.tag === "desc") {
    return `${indent}<${node.tag}>${escapeText(node.text ?? "")}</${node.tag}>\n`;
  }
  const attrStr = node.attrs
    ? ` ${Object.entries(node.attrs)
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(" ")}`
    : "";
  const kids = node.children ?? [];
  if (kids.length === 0 && !node.text) {
    return `${indent}<${node.tag}${attrStr}/>\n`;
  }
  let out = `${indent}<${node.tag}${attrStr}>\n`;
  for (const k of kids) out += ser(k, `${indent}  `);
  return `${out}${indent}</${node.tag}>\n`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
