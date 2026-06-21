# svg-tool

A TypeScript library + CLI for generating **game-art SVG tiles** and an
**AI tool** that produces those SVGs from a natural-language prompt.

## What's here

- **`src/lib/`** — the SVG library: types, primitives, palettes, registry,
  renderer, validator, seeded RNG. Assets are authored in a 0..100 viewBox and
  scaled at render time.
- **`src/assets/`** — declarative asset specs (terrain, buildings, units, ui).
  Importing the barrel registers them in the registry.
- **`src/generator/`** — the AI generator: builds a constrained system prompt,
  calls an OpenAI-compatible LLM, strips fences, validates with the same
  validator the library uses, retries once on validation failure, post-processes.
- **`src/cli/`** — `svg-tool` CLI.

## Asset coverage (initial)

| Category   | Assets                                            |
|------------|---------------------------------------------------|
| terrain    | grass, forest, water, mountain, road              |
| buildings  | castle, town, farmland                             |
| units      | archer, knight                                     |
| ui         | button, banner, coin                               |

Sizes: 32, 64, 128, 256 px.

## Quick start

```bash
bun install

# List registered assets
bun run src/cli/svg-tool.ts list

# Render a known asset
bun run src/cli/svg-tool.ts render terrain/grass --size 64 --seed 1 -o out.svg

# Generate a new SVG from a prompt (requires a local LLM at :8080)
bun run src/cli/svg-tool.ts generate "a forest tile with tall pine trees" --size 128
```

## Development

```bash
bun run typecheck   # tsc --noEmit
bun run test        # vitest run
bun run test:coverage
bun run lint        # biome lint
bun run format      # biome format --write
bun run build       # tsc -p tsconfig.build.json -> dist/
```

## Design principles

- **Assets are data, not code.** Each asset is a declarative spec consumed by
  the renderer; never hand-write `<svg>` strings inside asset files.
- **Deterministic by default.** Same input → same SVG bytes. Randomness is
  seeded (`mulberry32`); the seed is part of the asset id.
- **Tile size is a render-time concern.** Assets are authored in 0..100 and
  scaled to the requested px size at render time.
- **SVG output is validated.** A whitelist enforces allowed elements/attributes
  (no `<script>`, no event handlers, no remote refs). Run on every render and
  every AI output before writing to disk.
- **The AI generator never emits raw markup.** It reuses the library's
  primitives and palette names; the LLM is a composer, and the validator
  enforces the boundary.

See `.opencode/instructions/SVG_PROJECT.md` for the full conventions.