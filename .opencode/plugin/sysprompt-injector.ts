/**
 * Sysprompt Injector — opencode_coding override
 *
 * Extends the global sysprompt block with code-project enrichments:
 *   - Highlights test files among the changed-files set
 *   - Reminds the agent to re-run tests after non-trivial source edits
 *
 * Reuses the global plugin's git-state + edited-files block as a foundation.
 * Cached at the same 5-second TTL.
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { getChangedPaths, initStore } from "./lib/changed-files-store.js";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_TTL_MS = 5000;
const DEFAULT_MAX_FILES = 20;
const TEST_PATTERNS = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /_test\.go$/,
  /_test\.py$/,
  /tests?\//,
];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type GitSnapshot = {
  branch: string;
  head: string;
  subject: string;
  dirty: number;
  ahead: number;
  behind: number;
};

async function readGit($: PluginInput["$"], cwd: string): Promise<GitSnapshot> {
  const fallback: GitSnapshot = {
    branch: "?",
    head: "?",
    subject: "",
    dirty: 0,
    ahead: 0,
    behind: 0,
  };
  try {
    const branchOut = await $`git -C ${cwd} rev-parse --abbrev-ref HEAD`.quiet().nothrow().text();
    const branch = branchOut.trim() || "?";
    const headOut = await $`git -C ${cwd} rev-parse --short HEAD`.quiet().nothrow().text();
    const head = headOut.trim() || "?";
    const subjectOut = await $`git -C ${cwd} log -1 --format=%s`.quiet().nothrow().text();
    const subject = subjectOut.trim().split("\n")[0] || "";
    const dirtyOut = await $`git -C ${cwd} status --porcelain`.quiet().nothrow().text();
    const dirty = dirtyOut.trim() ? dirtyOut.trim().split("\n").length : 0;
    let ahead = 0;
    let behind = 0;
    const aheadBehindOut = await $`git -C ${cwd} rev-list --left-right --count @{upstream}...HEAD`
      .quiet()
      .nothrow()
      .text();
    const parts = aheadBehindOut.trim().split(/\s+/);
    if (parts.length === 2) {
      const b = Number.parseInt(parts[0], 10);
      const a = Number.parseInt(parts[1], 10);
      if (Number.isFinite(b)) behind = b;
      if (Number.isFinite(a)) ahead = a;
    }
    return { branch, head, subject, dirty, ahead, behind };
  } catch {
    return fallback;
  }
}

function isTestFile(p: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(p));
}

function renderBlock(
  snap: GitSnapshot,
  edited: Array<{ path: string; changeType: string }>,
  maxFiles: number,
): string {
  const lines: string[] = [];
  lines.push("# Session State (auto-injected)");
  lines.push("");
  lines.push(`- Branch: \`${snap.branch}\` @ \`${snap.head}\``);
  if (snap.subject) lines.push(`- Last commit: ${snap.subject}`);
  if (snap.dirty > 0) lines.push(`- Working tree: ${snap.dirty} file(s) modified`);
  else lines.push("- Working tree: clean");
  if (snap.ahead > 0 || snap.behind > 0) {
    lines.push(`- Vs upstream: ${snap.ahead} ahead, ${snap.behind} behind`);
  }

  if (edited.length > 0) {
    const tests = edited.filter((e) => isTestFile(e.path));
    const sources = edited.filter((e) => !isTestFile(e.path));

    lines.push("");
    lines.push(
      `## Recently edited (${edited.length}; tests: ${tests.length}, source: ${sources.length})`,
    );
    const shown = edited.slice(0, maxFiles);
    for (const f of shown) {
      const tag = f.changeType === "added" ? "A" : f.changeType === "deleted" ? "D" : "M";
      const marker = isTestFile(f.path) ? " [TEST]" : "";
      lines.push(`- [${tag}] ${f.path}${marker}`);
    }
    if (edited.length > maxFiles) lines.push(`- (+${edited.length - maxFiles} more)`);

    if (sources.length > 0 && tests.length === 0) {
      lines.push("");
      lines.push(
        "> Source files changed without test edits — consider running tests before committing.",
      );
    }
  }

  return lines.join("\n");
}

export const SyspromptInjector: Plugin = async ({ $, directory, worktree }: PluginInput) => {
  if (process.env.OPENCODE_SYSPROMPT_DISABLED === "1") {
    return {};
  }

  const ttlMs = parsePositiveInt(process.env.OPENCODE_SYSPROMPT_TTL_MS, DEFAULT_TTL_MS);
  const maxFiles = parsePositiveInt(process.env.OPENCODE_SYSPROMPT_MAX_FILES, DEFAULT_MAX_FILES);
  const cwd = worktree || directory;
  initStore(cwd);

  let cachedBlock: string | null = null;
  let cachedAt = 0;
  let cachedKey = "";

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const now = Date.now();
      const stale = now - cachedAt > ttlMs;

      let block = cachedBlock;
      if (stale || !block) {
        const snap = await readGit($, cwd);
        const edited = getChangedPaths();
        const editedDigest = edited
          .slice(0, maxFiles)
          .map((e) => `${e.changeType[0]}:${e.path}`)
          .join(",");
        const key = `${snap.branch}|${snap.head}|${snap.dirty}|${editedDigest}`;
        if (key !== cachedKey || !block) {
          block = renderBlock(snap, edited, maxFiles);
          cachedBlock = block;
          cachedKey = key;
        }
        cachedAt = now;
      }

      if (block) output.system.push(block);
    },
  };
};

export default SyspromptInjector;
