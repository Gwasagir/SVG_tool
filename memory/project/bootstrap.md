---
name: SVG Tool — Bootstrap Notes
description: How this project's .opencode/ config was assembled from the opencode_coding kit.
---

# SVG Tool — Bootstrap (2026-06-21)

- Source kit: `/home/niko/Projects/opencode_coding` (the coding delta kit; README explains the global ⊕ kit model).
- Ran `bash /home/niko/Projects/opencode_coding/scripts/bootstrap.sh /home/niko/SVG_tool --apply`.
- Dropped language-specific agents/commands we don't use (cpp/go/java/kotlin/python/rust) — TS-only project. `agent/` and `command/` dirs are now empty; the generic `build-error-resolver`/`code-reviewer` from global cover us.
- Kept skills: `api-design`, `backend-patterns`, `frontend-patterns`, `e2e-testing`, `eval-harness`, `strategic-compact`. Dropped `frontend-slides` (irrelevant).
- `opencode.jsonc` `instructions[]` = `[INSTRUCTIONS.md (kit delta), SVG_PROJECT.md (project conventions)]`. Global eager floor always applies underneath.
- `AGENTS.md` rewritten for this project (kit's version referenced per-language agents and skills/ that don't exist here).
- Plugin deps installed via `bun install` in `.opencode/` (only needed if tool/ or plugin/ copied).