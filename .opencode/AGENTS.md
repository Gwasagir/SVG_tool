# SVG Tool — System Prompt Header

Loaded eagerly (auto) every session, on top of the global config.

## Runtime

- **Model** `local/qwen3-35b-a3b` on `http://localhost:8080`. Verify:
  `curl -s localhost:8080/v1/models | jq .data[].id` must match the `model` key
  in `.opencode/opencode.jsonc` — mismatch silently falls back or errors.
- **Hooks** `ECC_HOOK_PROFILE=minimal|standard|strict` (default `minimal`).
  Tool-execution behavior may vary between sessions — check the env if
  something fires you didn't expect.

## Context discipline (read first every session)

1. Memory at `memory/{project,feedback,user,reference}/`, indexed by
   `memory/MEMORY.md` — `memory view /memories` at session start.
2. `rg` before whole-file reads; never read >2000 lines without a section.
3. Before editing: check memory → `rg` existing impls → list assumptions → edit.
4. Project conventions are in `.opencode/instructions/SVG_PROJECT.md` (loaded
   eagerly) — read once, then refer back.

## Tools

- **Custom** (`.opencode/tool/`) — `run-tests`, `check-coverage`, `format-code`,
  `lint-check`, `git-summary`, `security-audit`, `changed-files`.
- **Standard** — `read`, `write`, `edit`, `grep`, `glob`, `bash`, `webfetch`.

## Delegation

`planner` (>3 files / unclear scope) · `architect` (system design) ·
`tdd-guide` (new feature or bug fix) · `code-reviewer` (after >50-line edits) ·
`security-reviewer` (before commits / sensitive paths) ·
`build-error-resolver` (build fails) · `refactor-cleaner` (dead code) ·
`research-bot` (unfamiliar libs) · `doc-updater` · `md-archivist` (session end /
"save notes"). This is a **TypeScript-only** project — no per-language
reviewers/build-resolvers are wired in; use the generic agents above.

## Slash commands

`/plan` `/tdd` `/code-review` `/security` `/build-fix` `/verify` `/checkpoint`
`/orchestrate` `/refactor-clean` `/e2e` `/test-coverage` `/update-docs`.

## Skills (lazy, invoked via the skill tool)

From global: `coding-standards`, `security-review`, `tdd-workflow`,
`verification-loop`, `continuous-learning`. From this kit: `api-design`,
`backend-patterns`, `frontend-patterns`, `e2e-testing`, `eval-harness`,
`strategic-compact`.

## Tool calls

Valid JSON. Don't retry a failed call with the same args — diagnose first.
State intent before destructive bash.

## When done

Format → typecheck → tests → memory dump → commit message. Use `format-code`
(Biome), `tsc --noEmit`, `run-tests --coverage`, then write a commit message in
the global `<type>: <description>` format.

More: `.opencode/instructions/INSTRUCTIONS.md` (coding workflow delta),
`.opencode/instructions/SVG_PROJECT.md` (this project's conventions).