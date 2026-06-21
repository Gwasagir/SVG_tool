/**
 * Everything Claude Code (ECC) Plugin Hooks for OpenCode
 *
 * Hook Event Mapping (opencode 1.14.33):
 * - PreToolUse  → tool.execute.before        (top-level Hooks key)
 * - PostToolUse → tool.execute.after         (top-level Hooks key)
 * - Stop        → event → "session.idle"     (via generic `event` hook)
 * - SessionStart → event → "session.created" (via generic `event` hook)
 * - SessionEnd  → event → "session.deleted"  (via generic `event` hook)
 *
 * NOTE: file.edited / file.watcher.updated / session.created / session.idle /
 * session.deleted / todo.updated are NOT top-level Hooks interface keys in
 * 1.14.33 — they exist only as event-type discriminants on the SDK SSE stream
 * and must be handled inside the generic `event` hook.
 */

import * as fs from "fs";
import * as path from "path";
import type { PluginInput } from "@opencode-ai/plugin";
import changedFilesTool from "../tool/changed-files.js";
import { clearChanges, initStore, recordChange } from "./lib/changed-files-store.js";

type ECCHooksPluginFn = (input: PluginInput) => Promise<Record<string, unknown>>;

export const ECCHooksPlugin: ECCHooksPluginFn = async ({
  client,
  $,
  directory,
  worktree,
}: PluginInput) => {
  type HookProfile = "minimal" | "standard" | "strict";

  const worktreePath = worktree || directory;
  initStore(worktreePath);

  const editedFiles = new Set<string>();

  function resolvePath(p: string): string {
    if (path.isAbsolute(p)) return p;
    return path.join(worktreePath, p);
  }

  function hasProjectFile(relativePath: string): boolean {
    try {
      return fs.existsSync(resolvePath(relativePath));
    } catch {
      return false;
    }
  }

  const pendingToolChanges = new Map<string, { path: string; type: "added" | "modified" }>();
  let writeCounter = 0;

  function getFilePath(args: Record<string, unknown> | undefined): string | null {
    if (!args) return null;
    const p = (args.filePath ?? args.file_path ?? args.path) as string | undefined;
    return typeof p === "string" && p.trim() ? p : null;
  }

  function extractCommand(p: {
    pattern?: string | string[];
    metadata: Record<string, unknown>;
  }): string | undefined {
    if (typeof p.pattern === "string" && p.pattern.trim()) return p.pattern;
    if (Array.isArray(p.pattern)) {
      const first = p.pattern.find((s) => typeof s === "string" && s.trim());
      if (first) return first;
    }
    const md = p.metadata;
    for (const key of ["command", "cmd", "input", "script"]) {
      const v = md?.[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  }

  // Helper to call the SDK's log API with correct signature
  const log = (level: "debug" | "info" | "warn" | "error", message: string) =>
    client.app.log({ body: { service: "ecc", level, message } });

  const normalizeProfile = (value: string | undefined): HookProfile => {
    if (value === "minimal" || value === "strict") return value;
    return "standard";
  };

  const currentProfile = normalizeProfile(process.env.ECC_HOOK_PROFILE);
  const disabledHooks = new Set(
    (process.env.ECC_DISABLED_HOOKS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

  const profileOrder: Record<HookProfile, number> = {
    minimal: 0,
    standard: 1,
    strict: 2,
  };

  const profileAllowed = (required: HookProfile | HookProfile[]): boolean => {
    if (Array.isArray(required)) {
      return required.some((entry) => profileOrder[currentProfile] >= profileOrder[entry]);
    }
    return profileOrder[currentProfile] >= profileOrder[required];
  };

  const hookEnabled = (
    hookId: string,
    requiredProfile: HookProfile | HookProfile[] = "standard",
  ): boolean => {
    if (disabledHooks.has(hookId)) return false;
    return profileAllowed(requiredProfile);
  };

  return {
    /**
     * TypeScript Check Hook
     * Equivalent to Claude Code PostToolUse hook for tsc
     *
     * Triggers: After edit tool completes on .ts/.tsx files
     * Action: Runs tsc --noEmit to check for type errors
     */
    "tool.execute.after": async (
      input: {
        tool: string;
        callID?: string;
        args?: { filePath?: string; file_path?: string; path?: string };
      },
      output: unknown,
    ) => {
      const filePath = getFilePath(input.args as Record<string, unknown>);
      if (input.tool === "edit" && filePath) {
        recordChange(filePath, "modified");
      }
      if (input.tool === "write" && filePath) {
        const key = input.callID ?? `write-${++writeCounter}-${filePath}`;
        const pending = pendingToolChanges.get(key);
        if (pending) {
          recordChange(pending.path, pending.type);
          pendingToolChanges.delete(key);
        } else {
          recordChange(filePath, "modified");
        }
      }

      // Check if a TypeScript file was edited
      if (
        hookEnabled("post:edit:typecheck", ["strict"]) &&
        input.tool === "edit" &&
        input.args?.filePath?.match(/\.tsx?$/)
      ) {
        try {
          await $`npx tsc --noEmit 2>&1`;
          log("info", "[ECC] TypeScript check passed");
        } catch (error: unknown) {
          const err = error as { stdout?: string };
          log("warn", "[ECC] TypeScript errors detected:");
          if (err.stdout) {
            // Log first few errors
            const errors = err.stdout.split("\n").slice(0, 5);
            errors.forEach((line: string) => log("warn", `  ${line}`));
          }
        }
      }

      // PR creation logging
      if (
        hookEnabled("post:bash:pr-created", ["standard", "strict"]) &&
        input.tool === "bash" &&
        input.args?.toString().includes("gh pr create")
      ) {
        log("info", "[ECC] PR created - check GitHub Actions status");
      }
    },

    /**
     * Pre-Tool Security Check
     * Equivalent to Claude Code PreToolUse hook
     *
     * Triggers: Before tool execution
     * Action: Warns about potential security issues
     */
    "tool.execute.before": async (input: {
      tool: string;
      callID?: string;
      args?: Record<string, unknown>;
    }) => {
      if (input.tool === "write") {
        const filePath = getFilePath(input.args);
        if (filePath) {
          const absPath = resolvePath(filePath);
          let type: "added" | "modified" = "modified";
          try {
            if (typeof fs.existsSync === "function") {
              type = fs.existsSync(absPath) ? "modified" : "added";
            }
          } catch {
            type = "modified";
          }
          const key = input.callID ?? `write-${++writeCounter}-${filePath}`;
          pendingToolChanges.set(key, { path: filePath, type });
        }
      }

      // Git push review reminder
      if (
        hookEnabled("pre:bash:git-push-reminder", "strict") &&
        input.tool === "bash" &&
        input.args?.toString().includes("git push")
      ) {
        log("info", "[ECC] Remember to review changes before pushing: git diff origin/main...HEAD");
      }

      // Block creation of unnecessary documentation files
      if (
        hookEnabled("pre:write:doc-file-warning", ["standard", "strict"]) &&
        input.tool === "write" &&
        input.args?.filePath &&
        typeof input.args.filePath === "string"
      ) {
        const filePath = input.args.filePath;
        if (
          filePath.match(/\.(md|txt)$/i) &&
          !filePath.includes("README") &&
          !filePath.includes("CHANGELOG") &&
          !filePath.includes("LICENSE") &&
          !filePath.includes("CONTRIBUTING")
        ) {
          log("warn", `[ECC] Creating ${filePath} - consider if this documentation is necessary`);
        }
      }

      // Long-running command reminder
      if (hookEnabled("pre:bash:tmux-reminder", "strict") && input.tool === "bash") {
        const cmd = String(input.args?.command || input.args || "");
        if (
          cmd.match(/^(npm|pnpm|yarn|bun)\s+(install|build|test|run)/) ||
          cmd.match(/^cargo\s+(build|test|run)/) ||
          cmd.match(/^go\s+(build|test|run)/)
        ) {
          log("info", "[ECC] Long-running command detected - consider using background execution");
        }
      }
    },

    /**
     * Generic Event Hook (consolidates SDK SSE event subscriptions)
     *
     * The 1.14.33 Hooks interface does NOT expose top-level keys for
     * file.edited / file.watcher.updated / session.created / session.idle /
     * session.deleted / todo.updated. Those names exist only as event-type
     * discriminants on the SDK SSE stream and must be handled here.
     *
     * Event shapes mirror @opencode-ai/sdk gen/types.gen.d.ts (e.g.
     * EventFileEdited.properties.file, EventFileWatcherUpdated.properties.event
     * in {"add","change","unlink"}, EventTodoUpdated.properties.todos[].status).
     */
    event: async ({ event }: { event: { type: string; properties: any } }) => {
      switch (event.type) {
        case "file.edited": {
          const filePath: string = event.properties.file;
          editedFiles.add(filePath);
          recordChange(filePath, "modified");

          if (hookEnabled("post:edit:format", ["strict"]) && filePath.match(/\.(ts|tsx|js|jsx)$/)) {
            try {
              await $`prettier --write ${filePath} 2>/dev/null`;
              log("info", `[ECC] Formatted: ${filePath}`);
            } catch {
              // Prettier not installed or failed - silently continue
            }
          }

          if (
            hookEnabled("post:edit:console-warn", ["standard", "strict"]) &&
            filePath.match(/\.(ts|tsx|js|jsx)$/)
          ) {
            try {
              const result = await $`grep -n "console\\.log" ${filePath} 2>/dev/null`.text();
              if (result.trim()) {
                const lines = result.trim().split("\n").length;
                log(
                  "warn",
                  `[ECC] console.log found in ${filePath} (${lines} occurrence${lines > 1 ? "s" : ""})`,
                );
              }
            } catch {
              // No console.log found (grep returns non-zero)
            }
          }
          break;
        }

        case "file.watcher.updated": {
          const filePath: string = event.properties.file;
          const change: "add" | "change" | "unlink" = event.properties.event;
          const changeType: "added" | "modified" | "deleted" =
            change === "add" ? "added" : change === "unlink" ? "deleted" : "modified";
          recordChange(filePath, changeType);
          if (change === "change" && filePath.match(/\.(ts|tsx|js|jsx)$/)) {
            editedFiles.add(filePath);
          }
          break;
        }

        case "session.created": {
          if (!hookEnabled("session:start", ["minimal", "standard", "strict"])) break;
          log("info", `[ECC] Session started - profile=${currentProfile}`);
          if (hasProjectFile("CLAUDE.md")) {
            log("info", "[ECC] Found CLAUDE.md - loading project context");
          }
          break;
        }

        case "session.idle": {
          if (!hookEnabled("stop:check-console-log", ["minimal", "standard", "strict"])) break;
          if (editedFiles.size === 0) break;

          log("info", "[ECC] Session idle - running console.log audit");

          let totalConsoleLogCount = 0;
          const filesWithConsoleLogs: string[] = [];

          for (const file of editedFiles) {
            if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;
            try {
              const result = await $`grep -c "console\\.log" ${file} 2>/dev/null`.text();
              const count = Number.parseInt(result.trim(), 10);
              if (count > 0) {
                totalConsoleLogCount += count;
                filesWithConsoleLogs.push(file);
              }
            } catch {
              // No console.log found
            }
          }

          if (totalConsoleLogCount > 0) {
            log(
              "warn",
              `[ECC] Audit: ${totalConsoleLogCount} console.log statement(s) in ${filesWithConsoleLogs.length} file(s)`,
            );
            filesWithConsoleLogs.forEach((f) => log("warn", `  - ${f}`));
            log("warn", "[ECC] Remove console.log statements before committing");
          } else {
            log("info", "[ECC] Audit passed: No console.log statements found");
          }

          try {
            await $`osascript -e 'display notification "Task completed!" with title "OpenCode ECC"' 2>/dev/null`;
          } catch {
            // Notification not supported or failed
          }

          editedFiles.clear();
          break;
        }

        case "session.deleted": {
          if (!hookEnabled("session:end-marker", ["minimal", "standard", "strict"])) break;
          log("info", "[ECC] Session ended - cleaning up");
          editedFiles.clear();
          clearChanges();
          pendingToolChanges.clear();
          break;
        }

        case "todo.updated": {
          const todos: Array<{ status: string }> = event.properties.todos;
          const completed = todos.filter((t) => t.status === "completed").length;
          const total = todos.length;
          if (total > 0) {
            log("info", `[ECC] Progress: ${completed}/${total} tasks completed`);
          }
          break;
        }
      }
    },

    /**
     * Shell Environment Hook
     * OpenCode-specific: Inject environment variables into shell commands
     *
     * Triggers: Before shell command execution
     * Action: Sets PROJECT_ROOT, PACKAGE_MANAGER, DETECTED_LANGUAGES, ECC_VERSION
     */
    "shell.env": async () => {
      const env: Record<string, string> = {
        ECC_VERSION: "1.8.0",
        ECC_PLUGIN: "true",
        ECC_HOOK_PROFILE: currentProfile,
        ECC_DISABLED_HOOKS: process.env.ECC_DISABLED_HOOKS || "",
        PROJECT_ROOT: worktreePath,
      };

      // Detect package manager
      const lockfiles: Record<string, string> = {
        "bun.lockb": "bun",
        "pnpm-lock.yaml": "pnpm",
        "yarn.lock": "yarn",
        "package-lock.json": "npm",
      };
      for (const [lockfile, pm] of Object.entries(lockfiles)) {
        if (hasProjectFile(lockfile)) {
          env.PACKAGE_MANAGER = pm;
          break;
        }
      }

      // Detect languages
      const langDetectors: Record<string, string> = {
        "tsconfig.json": "typescript",
        "go.mod": "go",
        "pyproject.toml": "python",
        "Cargo.toml": "rust",
        "Package.swift": "swift",
      };
      const detected: string[] = [];
      for (const [file, lang] of Object.entries(langDetectors)) {
        if (hasProjectFile(file)) {
          detected.push(lang);
        }
      }
      if (detected.length > 0) {
        env.DETECTED_LANGUAGES = detected.join(",");
        env.PRIMARY_LANGUAGE = detected[0];
      }

      return env;
    },

    /**
     * Session Compacting Hook
     * OpenCode-specific: customize context compaction.
     *
     * Contract (1.14.33): (input: {sessionID}, output: {context: string[], prompt?: string}) => void.
     * MUTATE `output.context` (push extra strings) and optionally set `output.prompt`
     * to replace the default compaction prompt. Returning an object is a no-op.
     */
    "experimental.session.compacting": async (
      _input: { sessionID: string },
      output: { context: string[]; prompt?: string },
    ) => {
      // opencode_coding override: domain-specific compaction for code projects.
      // Preservation/discard targets are tuned for TDD + build/test + decision-log workflows.
      const TEST_RE = /(\.test\.[tj]sx?$|\.spec\.[tj]sx?$|_test\.go$|_test\.py$|tests?\/)/;

      const lines = [
        "# ECC Context — opencode_coding (code project)",
        "",
        "## Workflow Principles",
        "- TDD: write tests first, 80%+ coverage; preserve failing assertions verbatim across compaction",
        "- Immutability: never mutate, always return new copies",
        "- Security: validate inputs, no hardcoded secrets",
        "",
        "## Plugin Surface",
        "- Tools: run-tests, check-coverage, security-audit, format-code, lint-check, git-summary, changed-files, memory",
        "- Hooks: tool.execute.before/after, shell.env, permission.ask, session.compacting, file/session events",
        "- Memory tool: persist decisions / open questions to /memories/{project,feedback,user,reference}/ — survives compaction losslessly",
      ];

      if (editedFiles.size > 0) {
        const tests: string[] = [];
        const sources: string[] = [];
        for (const f of editedFiles) {
          if (TEST_RE.test(f)) tests.push(f);
          else sources.push(f);
        }
        lines.push(
          "",
          `## Recently Edited (${editedFiles.size}; tests: ${tests.length}, source: ${sources.length})`,
        );
        for (const f of editedFiles) {
          const tag = TEST_RE.test(f) ? " [TEST]" : "";
          lines.push(`- ${f}${tag}`);
        }
      }

      output.context.push(lines.join("\n"));
      output.prompt =
        "Compaction for a CODE project. " +
        "Preserve: failing test names + assertion text verbatim, type errors verbatim, decision log entries, " +
        "files touched in the last 20 edits (paths + change kind), open todos and their status, " +
        "security flags raised in this session, any prior `memory create`/`memory str_replace` calls and their target paths. " +
        "Discard: passing test logs, full file dumps that have already been processed, intermediate exploration trails, " +
        "redundant directory listings, formatter/linter output that succeeded. " +
        "When in doubt, keep file paths and decisions; drop large text bodies.";
    },

    /**
     * Permission Auto-Approve Hook
     * OpenCode-specific: auto-approve safe operations.
     *
     * Contract (1.14.33): (input: Permission, output: {status: "ask"|"deny"|"allow"}) => void.
     * `Permission` shape: {id, type, pattern?: string|string[], sessionID, messageID,
     * callID?, title, metadata: Record<string, unknown>, time: {created}}.
     * MUTATE `output.status` to take effect — returning an object is a no-op.
     *
     * NOTE: opencode does not request permission for read-only tools (read/glob/grep/list),
     * so the previous "auto-approve reads" branch was dead code and is removed.
     */
    "permission.ask": async (
      input: {
        type: string;
        pattern?: string | string[];
        title: string;
        metadata: Record<string, unknown>;
      },
      output: { status: "ask" | "deny" | "allow" },
    ) => {
      const cmd = extractCommand(input);
      log(
        "info",
        `[ECC] Permission requested: type=${input.type} title="${input.title}"${cmd ? ` cmd="${cmd}"` : ""}`,
      );

      const isShell = input.type === "shell" || input.type === "bash";
      if (isShell && cmd) {
        if (/^(npx\s+)?(prettier|biome|black|gofmt|rustfmt|swift-format)\b/.test(cmd)) {
          output.status = "allow";
          log("info", "[ECC] Auto-approved: formatter");
          return;
        }
        if (/^(npm\s+test|npx\s+(vitest|jest)|pytest|go\s+test|cargo\s+test)\b/.test(cmd)) {
          output.status = "allow";
          log("info", "[ECC] Auto-approved: test command");
          return;
        }
      }
      // Otherwise leave output.status untouched → defer to user / config defaults.
    },

    tool: {
      "changed-files": changedFilesTool,
    },
  };
};

export default ECCHooksPlugin;
