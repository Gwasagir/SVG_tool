---
name: SVG Tool — Core Decisions
description: Foundational tech stack and architectural choices for the SVG tool project.
---

# SVG Tool — Core Decisions (2026-06-21)

## Stack (fixed)
- **Language:** TypeScript (strict, `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`).
- **Runtime/PM:** Bun 1.3+ for install + test; Node 20 for the CLI binary (no Bun-only runtime APIs).
- **Test:** Vitest 2.x with `@vitest/coverage-v8` v2 (v4 is incompatible — must match vitest major).
- **Lint/format:** Biome 1.9. No ESLint/Prettier.
- **Build:** `tsc -p tsconfig.build.json` → `dist/`; CLI bundled with `bun build`.

## Architecture
- Assets authored in 0..100 viewBox, scaled to px at render time.
- `AssetSpec.build(ctx)` is pure: palette colors via `color(palette, name)` helper (throws on missing), randomness via `ctx.rng` (mulberry32, seeded).
- Import path style: **extensionless** (`from "./types"` not `.js`) — Vite/Vitest doesn't resolve `.js`→`.ts` by default; Bundler moduleResolution handles it for tsc.
- Asset files live in `src/assets/<category>/` and import from `../../lib/` (two levels up).
- Validator is the security boundary: whitelist of tags + attrs, denies `on*`, `href`, `xlink:href`, `javascript:`, remote `url()`. Run on every render + every AI output.

## AI generator
- OpenAI-compatible chat completions endpoint; default `localhost:8080/v1` (local qwen), overridable via `OPENAI_BASE_URL`/`OPENAI_API_KEY`/`OPENAI_MODEL`.
- Flow: prompt → constrained system prompt (lists primitives + palette colors) → LLM → stripFences → parseSvg → validate → retry once with errors quoted → postProcess → write.
- `parseSvg` is a recursive-descent parser that throws on malformed input (missing close tag, trailing garbage) so `parseSvg` returns null.

## What NOT to add
- Per-language agents (cpp/go/rust/etc.) — TS-only project; generic build-error-resolver/code-reviewer cover it.
- ESLint, Prettier, ts-node.
- A web UI in this repo — CLI is the interface.