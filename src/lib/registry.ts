// Asset registry — maps asset ids to their specs. Assets are registered at
// module load by the assets/* modules. The registry is the single source of
// truth for "what can we render?".

import type { AssetSpec } from "./types";

const REGISTRY = new Map<string, AssetSpec>();

/** Register an asset spec. Idempotent: re-registering the same id is a no-op. */
export function register(spec: AssetSpec): void {
  if (REGISTRY.has(spec.id)) {
    throw new Error(`Duplicate asset id: ${spec.id}`);
  }
  REGISTRY.set(spec.id, spec);
}

/** Register many specs at once (convenience). */
export function registerAll(specs: AssetSpec[]): void {
  for (const s of specs) register(s);
}

/** Look up a spec by id, or undefined if not found. */
export function get(id: string): AssetSpec | undefined {
  return REGISTRY.get(id);
}

/** List all registered asset ids. */
export function list(): string[] {
  return [...REGISTRY.keys()].sort();
}

/** List ids filtered by category. */
export function listByCategory(category: AssetSpec["category"]): string[] {
  return [...REGISTRY.values()]
    .filter((s) => s.category === category)
    .map((s) => s.id)
    .sort();
}

/** Clear the registry (tests only). */
export function _clearForTests(): void {
  REGISTRY.clear();
}
