#!/usr/bin/env node
// svg-tool — CLI for the SVG tile library + AI generator.
// Usage:
//   svg-tool render <id> [--size N] [--seed N] [-o path]   render a known asset
//   svg-tool list [--category C]                            list registered assets
//   svg-tool generate "<prompt>" [--category C] [--size N] [--seed N] [-o path]
//   svg-tool palettes                                        list palettes
// To register assets, the CLI imports the assets barrel (side effect).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getPalette, list, listByCategory, render } from "../lib";
import "../assets"; // register all assets (side effect)
import { generate } from "../generator";
import type { AssetCategory, TileSize } from "../lib/types";

const SIZES: ReadonlyArray<TileSize> = [32, 64, 128, 256];

interface ParsedArgs {
  cmd: string;
  positional: string[];
  opts: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd: positional[0] ?? "", positional: positional.slice(1), opts };
}

function isTileSize(n: number): n is TileSize {
  return (SIZES as ReadonlyArray<number>).includes(n);
}

function parseSize(raw: string | undefined, fallback = 128): TileSize {
  const n = Number(raw ?? fallback);
  if (!isTileSize(n)) {
    console.error(`Invalid size: ${raw ?? fallback}. Allowed: ${SIZES.join(", ")}`);
    process.exit(2);
  }
  return n;
}

async function main(): Promise<void> {
  const { cmd, positional, opts } = parseArgs(process.argv.slice(2));

  if (cmd === "list") {
    const cat = opts.category as AssetCategory | undefined;
    const ids = cat ? listByCategory(cat) : list();
    for (const id of ids) console.log(id);
    return;
  }

  if (cmd === "palettes") {
    for (const name of Object.keys(getPalette("terrain"))) {
      console.log(name);
    }
    const { PALETTES } = await import("../lib/palette");
    for (const name of Object.keys(PALETTES)) console.log(name);
    return;
  }

  if (cmd === "render") {
    const id = positional[0] ?? opts.id ?? "";
    if (!id) {
      console.error("usage: svg-tool render <id> [--size N] [--seed N] [-o path]");
      process.exit(2);
    }
    const size = parseSize(opts.size);
    const seed = opts.seed !== undefined ? Number(opts.seed) : 0;
    const out = render(id, { size, seed });
    const path = opts.o ?? `svg/${id.replace("/", "-")}-${size}.svg`;
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, out.svg);
    console.log(`Wrote ${path} (${out.bytes} bytes)`);
    return;
  }

  if (cmd === "generate") {
    const prompt = opts.prompt ?? positional[0] ?? "";
    if (!prompt) {
      console.error(
        'usage: svg-tool generate "<prompt>" [--category C] [--size N] [--seed N] [-o path]',
      );
      process.exit(2);
    }
    const size = parseSize(opts.size);
    const result = await generate({
      prompt,
      size,
      category: opts.category as AssetCategory | undefined,
      seed: opts.seed !== undefined ? Number(opts.seed) : undefined,
    });
    const path = opts.o ?? `svg/${result.category}-${result.seed}-${result.size}.svg`;
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, result.svg);
    console.log(`Wrote ${path} (${result.svg.length} bytes, ${result.attempts} attempt(s))`);
    return;
  }

  console.error(`Unknown command: ${cmd || "(none)"}`);
  console.error("Commands: render, list, generate, palettes");
  process.exit(2);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
