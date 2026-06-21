// SVG primitive helpers. Assets compose trees from these — never hand-write
// `<svg>` strings. Each helper returns a plain SvgNode, cheap and immutable.

import type { SvgNode } from "./types";

/** Shorthand for a group with optional transform and children. */
export function g(transform: string | undefined, children: SvgNode[]): SvgNode {
  const attrs: Record<string, string | number> = {};
  if (transform !== undefined) attrs.transform = transform;
  return { tag: "g", attrs, children };
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  return { tag: "rect", attrs: { x, y, width: w, height: h, fill, ...opts } };
}

export function circle(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  return { tag: "circle", attrs: { cx, cy, r, fill, ...opts } };
}

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  return { tag: "ellipse", attrs: { cx, cy, rx, ry, fill, ...opts } };
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  return { tag: "line", attrs: { x1, y1, x2, y2, stroke, ...opts } };
}

/** Build a <polyline> from a points array. */
export function polyline(
  points: Array<[number, number]>,
  stroke: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  const pts = points.map(([x, y]) => `${x},${y}`).join(" ");
  return { tag: "polyline", attrs: { points: pts, fill: "none", stroke, ...opts } };
}

/** Build a <polygon> from a points array (closed, filled). */
export function polygon(
  points: Array<[number, number]>,
  fill: string,
  opts: Partial<Record<string, string | number>> = {},
): SvgNode {
  const pts = points.map(([x, y]) => `${x},${y}`).join(" ");
  return { tag: "polygon", attrs: { points: pts, fill, ...opts } };
}

/**
 * Build a <path>. `d` is the path data string. Prefer the path-* helpers for
 * common shapes; use this only when you need a custom path.
 */
export function path(d: string, opts: Partial<Record<string, string | number>> = {}): SvgNode {
  return { tag: "path", attrs: { d, ...opts } };
}

/** A linear gradient definition. Returns the <linearGradient> node for <defs>. */
export function linearGradient(
  id: string,
  stops: Array<[offset: number, color: string]>,
  direction = "vertical",
): SvgNode {
  const gradAttrs: Record<string, string | number> = { id };
  if (direction === "vertical") {
    gradAttrs.x1 = 0;
    gradAttrs.y1 = 0;
    gradAttrs.x2 = 0;
    gradAttrs.y2 = 1;
  } else {
    gradAttrs.x1 = 0;
    gradAttrs.y1 = 0;
    gradAttrs.x2 = 1;
    gradAttrs.y2 = 0;
  }
  return {
    tag: "linearGradient",
    attrs: gradAttrs,
    children: stops.map(([offset, color]) => ({
      tag: "stop" as const,
      attrs: { offset: `${offset * 100}%`, "stop-color": color },
    })),
  };
}

/** Wrap nodes in a <defs> block. */
export function defs(nodes: SvgNode[]): SvgNode {
  return { tag: "defs", children: nodes };
}

/** Accessibility helpers — <title> and <desc> for screen readers. */
export function title(text: string): SvgNode {
  return { tag: "title", text };
}
export function desc(text: string): SvgNode {
  return { tag: "desc", text };
}
