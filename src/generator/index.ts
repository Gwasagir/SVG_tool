// AI generator — turns a free-text prompt into an SVG file via an LLM.
// Flow: prompt → build a constrained system prompt (allowed primitives,
// palettes, the target category's conventions) → call an OpenAI-compatible
// LLM → strip markdown fences → validate with the library's validator →
// one retry with validation errors quoted back → post-process → return.

import { getPalette } from "../lib/palette";
import { listByCategory } from "../lib/registry";
import { hashString } from "../lib/rng";
import type { AssetCategory, SvgNode, TileSize } from "../lib/types";
import { type ValidationResult, validate } from "../lib/validate";

export interface GenerateOptions {
  prompt: string;
  category?: AssetCategory | undefined;
  size?: TileSize | undefined;
  seed?: number | undefined;
  palette?: string | undefined;
  /** Override the LLM endpoint. Defaults to env or localhost:8080. */
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  model?: string | undefined;
  /** Max retries on validation failure (default 1). */
  retries?: number | undefined;
}

export interface GenerateResult {
  svg: string;
  category: AssetCategory;
  size: TileSize;
  seed: number;
  attempts: number;
  validation: ValidationResult;
}

const CATEGORIES: AssetCategory[] = ["terrain", "buildings", "units", "ui"];

/** Default endpoint — local llama.cpp / qwen server. */
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ?? "http://localhost:8080/v1";
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY ?? "not-needed";
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "qwen3-35b-a3b";

/** Infer category from prompt keywords. */
export function inferCategory(prompt: string): AssetCategory {
  const p = prompt.toLowerCase();
  if (/\b(castle|town|farm|barn|house|building|tower|wall)\b/.test(p)) return "buildings";
  if (/\b(archer|knight|soldier|unit|figure|warrior|troop)\b/.test(p)) return "units";
  if (/\b(button|banner|icon|coin|frame|panel|ui)\b/.test(p)) return "ui";
  if (/\b(grass|forest|water|sea|mountain|road|terrain|tile)\b/.test(p)) return "terrain";
  return "terrain";
}

/** Main entry: generate an SVG from a prompt. */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const category = opts.category ?? inferCategory(opts.prompt);
  const size = opts.size ?? 128;
  const seed = opts.seed ?? hashString(opts.prompt);
  const paletteName = opts.palette ?? category;
  const palette = getPalette(paletteName);
  const maxAttempts = (opts.retries ?? 1) + 1;

  const sys = buildSystemPrompt(category, size, paletteName);
  let attempts = 0;
  let lastValidation: ValidationResult = { valid: false, errors: [] };
  let svg = "";

  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    const userContent =
      attempts === 1
        ? opts.prompt
        : `${opts.prompt}\n\nYour previous output was invalid:\n${lastValidation.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")}\n\nFix these issues and output only the SVG.`;

    const raw = await callLLM(sys, userContent, {
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: opts.apiKey ?? DEFAULT_API_KEY,
      model: opts.model ?? DEFAULT_MODEL,
    });
    svg = stripFences(raw);
    const tree = parseSvg(svg);
    if (!tree) {
      lastValidation = {
        valid: false,
        errors: [{ path: "svg", message: "Failed to parse SVG from LLM output" }],
      };
      continue;
    }
    lastValidation = validate(tree);
    if (lastValidation.valid) break;
  }

  if (!lastValidation.valid) {
    throw new Error(
      `Generator failed after ${attempts} attempt(s). Last errors:\n${lastValidation.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`,
    );
  }

  const final = postProcess(svg, size, seed, category);
  return { svg: final, category, size, seed, attempts, validation: lastValidation };
}

/** Build the constrained system prompt listing allowed primitives/palettes. */
function buildSystemPrompt(category: AssetCategory, size: TileSize, paletteName: string): string {
  const examples = listByCategory(category).join(", ") || "(none yet)";
  const palette = getPalette(paletteName);
  const colorNames = Object.keys(palette.colors).join(", ");
  return [
    "You are an SVG tile generator for a strategy game. Output ONLY a single <svg> document.",
    `Tile size: ${size}x${size} pixels. Use viewBox="0 0 100 100" and width="${size}" height="${size}".`,
    `Category: ${category}. Existing examples in this category: ${examples}.`,
    `Palette "${paletteName}" — use these colors by name as fill/stroke values (hex below):`,
    ...Object.entries(palette.colors).map(([k, v]) => `  ${k}=${v}`),
    `Available color names: ${colorNames}.`,
    "Allowed SVG elements: svg, g, rect, circle, ellipse, line, polyline, polygon, path, defs, linearGradient, radialGradient, stop, use, title, desc.",
    "Forbidden: <script>, event handler attributes (onclick, onload, etc.), href/xlink:href to remote, javascript: URLs, external resources.",
    "Compose the scene from primitives. Use the palette colors above; do not invent raw hex colors inline.",
    "Author in a 0..100 coordinate space; the renderer scales to the target size.",
    "Output exactly one <svg>...</svg> block, no markdown fences, no explanation.",
  ].join("\n");
}

/** Call an OpenAI-compatible chat completions endpoint. */
async function callLLM(
  system: string,
  user: string,
  conn: { baseUrl: string; apiKey: string; model: string },
): Promise<string> {
  const url = `${conn.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.apiKey}` },
    body: JSON.stringify({
      model: conn.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM call failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");
  return content;
}

/** Strip markdown code fences (```svg ... ``` or ``` ... ```) from LLM output. */
export function stripFences(raw: string): string {
  const m = raw.match(/```(?:svg|xml)?\s*\n?([\s\S]*?)```/i);
  return (m?.[1] ?? raw).trim();
}

/**
 * Parse an SVG string into an SvgNode tree. Lenient about whitespace; strict
 * about structure (throws on missing close tags, which makes parseSvg return
 * null). Not a full XML parser (no namespaces, no CDATA, no entities).
 */
export function parseSvg(svg: string): SvgNode | null {
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<")) return null;
  try {
    const { node, pos } = parseElementAt(trimmed, 0);
    // Reject trailing non-whitespace garbage after the root element.
    const tail = trimmed.slice(pos).trim();
    if (tail !== "") throw new Error(`Trailing content after root element: ${tail.slice(0, 40)}`);
    return node;
  } catch {
    return null;
  }
}

// Recursive descent parser operating on a string + index. Throws on malformed
// input so parseSvg() can catch and return null.
function parseElementAt(s: string, start: number): { node: SvgNode; pos: number } {
  const i = skipWhitespace(s, start);
  if (s.charCodeAt(i) !== 60 /* '<' */) throw new Error(`Expected '<' at ${i}`);
  // Find the end of the opening tag.
  const tagEnd = s.indexOf(">", i);
  if (tagEnd === -1) throw new Error("Unterminated opening tag");
  const tagInner = s.slice(i + 1, tagEnd).trim();
  const selfClosing = tagInner.endsWith("/");
  const inner = selfClosing ? tagInner.slice(0, -1).trim() : tagInner;
  const { tag, attrs } = parseTagInner(inner);
  let pos = tagEnd + 1;
  if (selfClosing) return { node: { tag, attrs }, pos };

  // Parse children / text until matching close tag.
  const children: SvgNode[] = [];
  const closeTag = `</${tag}>`;
  while (true) {
    pos = skipWhitespace(s, pos);
    // Check for our close tag.
    if (s.startsWith(closeTag, pos)) {
      pos += closeTag.length;
      return { node: children.length ? { tag, attrs, children } : { tag, attrs }, pos };
    }
    // Check for any close tag (mismatched = malformed).
    if (s.startsWith("</", pos)) {
      throw new Error(`Mismatched close tag at ${pos}: expected </${tag}>`);
    }
    // Text node child (for <title>/<desc>).
    const nextLt = s.indexOf("<", pos);
    if (nextLt === -1) throw new Error(`Missing close tag </${tag}>`);
    if (nextLt > pos) {
      const text = s.slice(pos, nextLt).trim();
      if (text) {
        // Text content — treat as text node (title/desc use .text).
        children.push({ tag: "title", text });
      }
      pos = nextLt;
    }
    // Parse child element.
    const child = parseElementAt(s, pos);
    children.push(child.node);
    pos = child.pos;
  }
}

function parseTagInner(inner: string): {
  tag: SvgNode["tag"];
  attrs: Record<string, string | number>;
} {
  const spaceIdx = inner.search(/\s/);
  const tag = (spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)) as SvgNode["tag"];
  const attrsStr = spaceIdx === -1 ? "" : inner.slice(spaceIdx + 1).trim();
  const attrs: Record<string, string | number> = {};
  const re = /([a-zA-Z:][a-zA-Z0-9:_-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  m = re.exec(attrsStr);
  while (m !== null) {
    attrs[m[1] as string] = m[2] as string;
    m = re.exec(attrsStr);
  }
  return { tag, attrs };
}

function skipWhitespace(s: string, start: number): number {
  let i = start;
  while (i < s.length && /\s/.test(s[i] ?? "")) i++;
  return i;
}

/** Final post-processing: ensure width/height/viewBox are correct. */
function postProcess(svg: string, size: TileSize, seed: number, category: AssetCategory): string {
  // Replace any existing width/height/viewBox with the correct values.
  let out = svg
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace(/\sviewBox="[^"]*"/, "");
  const inject = ` width="${size}" height="${size}" viewBox="0 0 100 100"`;
  out = out.replace(/<svg([^>]*)>/, `<svg$1${inject}>`);
  // Add a desc with the seed for reproducibility.
  const desc = `<desc>svg-tool generated — category=${category} size=${size} seed=${seed}</desc>`;
  out = out.replace(/(<svg[^>]*>)/, `$1${desc}`);
  return out;
}
