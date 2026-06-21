// SVG validator — enforces a whitelist of allowed elements and attributes.
// Run on every render and on every AI-generated SVG before writing to disk.
// This is the security boundary: no <script>, no event handlers, no remote
// refs, no XSS surface.

import type { SvgNode, SvgTag } from "./types";

const ALLOWED_TAGS: ReadonlySet<SvgTag> = new Set([
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "use",
  "title",
  "desc",
]);

// Attribute prefixes/names that are always denied (XSS / external resource).
const DENIED_ATTR_PATTERNS: ReadonlyArray<RegExp> = [
  /^on/i, // event handlers: onclick, onload, etc.
];
const DENIED_ATTR_EXACT: ReadonlySet<string> = new Set(["href", "xlink:href"]);
// Allowed attributes on any element. Anything not here is flagged.
const ALLOWED_ATTRS: ReadonlySet<string> = new Set([
  "id",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "d",
  "points",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "transform",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "viewBox",
  "xmlns",
  "clip-path",
  "clip-rule",
]);

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate an SvgNode tree. Returns all errors found (does not short-circuit),
 * so the caller can report the full list to the LLM in one retry.
 */
export function validate(root: SvgNode): ValidationResult {
  const errors: ValidationError[] = [];
  walk(root, "svg", errors);
  return { valid: errors.length === 0, errors };
}

function walk(node: SvgNode, path: string, errors: ValidationError[]): void {
  // Tag whitelist.
  if (!ALLOWED_TAGS.has(node.tag)) {
    errors.push({ path, message: `Disallowed tag <${node.tag}>` });
    // Still descend, to catch nested issues, but skip attrs for unknown tags.
  }

  // Attribute check.
  const attrs = node.attrs ?? {};
  for (const key of Object.keys(attrs)) {
    if (DENIED_ATTR_EXACT.has(key) || DENIED_ATTR_PATTERNS.some((re) => re.test(key))) {
      errors.push({
        path: `${path}[${key}]`,
        message: `Denied attribute "${key}" (XSS/external-ref risk)`,
      });
      continue;
    }
    if (!ALLOWED_ATTRS.has(key)) {
      errors.push({ path: `${path}[${key}]`, message: `Unknown attribute "${key}"` });
    }
    // No remote-ish string values inside known attrs.
    const v = String(attrs[key]);
    if (/url\(.*https?:/i.test(v) || v.toLowerCase().startsWith("javascript:")) {
      errors.push({ path: `${path}[${key}]`, message: `Unsafe attribute value: "${v}"` });
    }
  }

  // Children.
  const kids = node.children ?? [];
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (child) walk(child, `${path}/${child.tag ?? "?"}[${i}]`, errors);
  }
}
