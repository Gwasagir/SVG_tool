# SVG Tool — Project Conventions

Loaded eagerly on top of the kit's coding workflow delta and the global config.
This file captures the SVG-specific conventions for this repo so every session
starts with them.

## What this project is

A TypeScript library + CLI for generating game-art **SVG tiles**, and an
**AI tool** that produces those SVGs from a natural-language prompt (LLM → SVG
text). Targets: 32×32, 64×64, 128×128, 256×256 px tiles. Categories: terrain
(grass, forest, water, mountain, road), buildings (castle, town, farmland),
units (archer, knight, etc.), UI/icons (buttons, banners, resource symbols).

## Tech stack (fixed)

- **Language:** TypeScript (strict).
- **Runtime/package manager:** Bun (1.3+) for install + test; Node 20 for the
  CLI binary (`#!/usr/bin/env node` shebang, no Bun-specific runtime APIs).
- **Test framework:** Vitest (node environment, 80%+ coverage enforced via
  `check-coverage`).
- **Lint/format:** Biome (no ESLint/Prettier). Run via `lint-check` /
  `format-code` custom tools.
- **Build:** `tsc -p tsconfig.build.json` → `dist/`; the CLI is bundled with
  `bun build` to `dist/cli/svg-tool.js` as a standalone script.

## Layout

```
src/
  lib/        the SVG library — types, primitives, registry, renderer, palette
  assets/     declarative asset definitions (terrain/, buildings/, units/, ui/)
  generator/  AI generator: prompt assembly, LLM client, SVG validation, post-process
  cli/        the `svg-tool` CLI
tests/        unit + integration tests (mirrors src/ layout)
svg/          generated SVG output (gitignored except for curated samples)
```

## Conventions

- **Assets are data, not code.** Each asset is a declarative spec (a TypeScript
  object literal) consumed by the renderer. Never hand-write `<svg>` strings
  inside asset files — compose from the primitive helpers in `src/lib/primitives`.
- **Deterministic by default.** Same input → same SVG bytes. Any randomness is
  seeded (`mulberry32`) and the seed is part of the asset's id so output is
  reproducible. The AI generator sets the seed from the prompt hash.
- **One palette per category.** Palettes live in `src/lib/palette.ts` and are
  referenced by name. The generator may swap palettes but never invent raw
  hex colors inline.
- **Tile size is a render-time concern.** Assets are authored in a 0–100
  viewBox and scaled to the requested px size at render time. Do not bake
  `64`/`128` into asset definitions.
- **SVG output must be valid + safe.** All generated SVG is validated against a
  whitelist of allowed elements/attributes (no `script`, no external refs, no
  `xlink:href` to remote, no inline event handlers). The validator is in
  `src/lib/validate.ts` and is run on every render and on every AI output before
  it is written to disk.
- **Tests cover the validator and every primitive.** New assets ship with a
  snapshot test (`expect(render(spec)).toMatchSVGSnapshot()`) plus a validation
  test. Snapshot files live in `tests/__snapshots__/`.

## AI generator design

- Input: a free-text prompt + optional `{ size, category, seed, palette }`.
- Output: one SVG string written to `svg/<category>/<name>-<size>.svg`.
- Flow: prompt → build a constrained system prompt (lists allowed primitives,
  palettes, the target category's conventions) → call the configured LLM (local
  qwen via OpenAI-compatible API at `localhost:8080/v1` by default, or any
  `OPENAI_BASE_URL`/`OPENAI_API_KEY`) → strip markdown fences → validate with
  the same validator the library uses → if invalid, one retry with the
  validation errors quoted back → post-process (strip comments, set the final
  `width`/`height`/`viewBox`, normalize whitespace) → write.
- The generator never writes SVG that the library couldn't also produce — it
  reuses the same primitives and palette names. The LLM is a composer, not a
  raw-markup emitter; the validator enforces this.

## Commit / branch policy

Per global rules: `main` protected, work on `feat/*` / `fix/*` branches, merge
via PR. Commit messages: `<type>: <description>`.

## Don't

- Don't add a per-language agent (cpp/go/rust/etc.) — this is TS-only. The
  generic `build-error-resolver` and `code-reviewer` cover us.
- Don't pull in ESLint, Prettier, or ts-node. Bun + tsc + Biome + Vitest only.
- Don't add a web UI in this repo. The CLI is the interface; a UI, if ever, is a
  separate repo.