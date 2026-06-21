# Coding Kit — Workflow Delta

Loaded eagerly **on top of** the global `INSTRUCTIONS.md` (which already covers
Git/branch policy, runtime, memory-at-session-start, and success criteria — not
repeated here). This file adds only the coding-specific workflow. Agent and
command catalog: `.opencode/AGENTS.md`. Universal coding-style / security /
testing / patterns rules live in the **global** config and its lazy
`coding-standards` skill — this kit ships no `rules/` of its own.

## Feature implementation loop

1. **Plan** with `planner` — identify dependencies and risks, break into phases.
2. **TDD** with `tdd-guide` — RED → GREEN → REFACTOR, verify 80%+ coverage.
3. **Review** with `code-reviewer` — fix CRITICAL/HIGH first, MEDIUM where feasible.
4. **Commit** in the global commit format.

If a build fails: invoke `build-error-resolver` (or the language-specific
`<lang>-build-resolver` shipped by this kit), analyze, fix incrementally, verify
after each fix.

## Immediate agent usage (no user prompt needed)

- Complex feature request → `planner`
- Code just written or modified → `code-reviewer`
- Bug fix or new feature → `tdd-guide`
- Architectural decision → `architect`
- Language-specific build break / review → `<lang>-build-resolver` / `<lang>-reviewer`
  (`go`, `rust`, `java`, `kotlin`, `cpp`, `python`)

## Context budget

Avoid the last 20% of the context window for large refactors, multi-file
features, and complex debugging.

## Plugin hooks (`plugin/ecc-hooks.ts`) — coding profiles

`ECC_HOOK_PROFILE` (default `minimal`) selects which events fire:

- **minimal** — `session:start`, `session:end-marker`, `stop:check-console-log`
- **standard** — adds `post:edit:console-warn`, `pre:write:doc-file-warning`, `post:bash:pr-created`, `pre:bash:git-push-reminder`
- **strict** — adds `post:edit:format` (prettier), `post:edit:typecheck` (tsc), `pre:bash:tmux-reminder`

Supported opencode events: `tool.execute.before`, `tool.execute.after`,
`shell.env`, `permission.ask`, `experimental.session.compacting`. The
`session.*` / `file.*` / `todo.updated` events silently no-op on opencode
1.14.33. The macOS `osascript` notification is try/catch-wrapped (fails silently
on Linux).
