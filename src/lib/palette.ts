// Named palettes for SVG tiles. The generator and assets reference colors by
// name from these palettes; raw hex colors should never appear in asset files.

import type { Palette } from "./types";

export const PALETTE_TERRAIN: Palette = {
  name: "terrain",
  colors: {
    grass: "#6abe30",
    grassDark: "#4f8f24",
    forest: "#2d6a2d",
    forestDark: "#1b4d1b",
    water: "#3d7bd9",
    waterDark: "#2a5cb0",
    waterLight: "#6fa8e8",
    mountain: "#8a8a8a",
    mountainDark: "#5a5a5a",
    mountainSnow: "#e8e8e8",
    road: "#c9a86a",
    roadDark: "#9b7d3f",
    sand: "#e3d29b",
    soil: "#7a5230",
  },
};

export const PALETTE_BUILDINGS: Palette = {
  name: "buildings",
  colors: {
    wall: "#b0b0b0",
    wallDark: "#7a7a7a",
    roof: "#b5422d",
    roofDark: "#8a2f1f",
    wood: "#9b6b3f",
    woodDark: "#6b4a2a",
    stone: "#9a9a9a",
    stoneDark: "#6a6a6a",
    door: "#5a3a1a",
    window: "#3d6fb0",
    flag: "#d9b53d",
    flagPole: "#4a4a4a",
    field: "#b8a55a",
    fieldCrop: "#d4a73a",
    fieldDark: "#8a7a3a",
    road: "#c9a86a",
    roadDark: "#9b7d3f",
  },
};

export const PALETTE_UNITS: Palette = {
  name: "units",
  colors: {
    body: "#e0c4a0",
    bodyDark: "#a08a6a",
    cloak: "#4a6a9a",
    cloakDark: "#2f4a7a",
    armor: "#9a9a9a",
    armorDark: "#6a6a6a",
    weapon: "#5a4a3a",
    weaponMetal: "#c0c0c0",
    bow: "#8a6a3a",
    bowstring: "#d8d8d8",
    arrow: "#6a5a3a",
    shield: "#7a3a2a",
    shieldTrim: "#d9b53d",
    banner: "#b5422d",
    bannerPole: "#4a4a4a",
    skinTone: "#e0c4a0",
  },
};

export const PALETTE_UI: Palette = {
  name: "ui",
  colors: {
    frame: "#5a4a3a",
    frameLight: "#7a6a5a",
    panel: "#3a2a1a",
    panelLight: "#5a4a3a",
    ink: "#f0e0c0",
    inkDark: "#a09070",
    gold: "#d9b53d",
    goldDark: "#9a7a1f",
    scroll: "#e3d29b",
    scrollDark: "#b8a55a",
    red: "#b5422d",
    green: "#6abe30",
    blue: "#3d7bd9",
    bannerPole: "#4a4a4a",
  },
};

/** All palettes keyed by name. The generator and registry look up here. */
export const PALETTES: Record<string, Palette> = {
  terrain: PALETTE_TERRAIN,
  buildings: PALETTE_BUILDINGS,
  units: PALETTE_UNITS,
  ui: PALETTE_UI,
};

/** Look up a palette by name, throwing if missing. */
export function getPalette(name: string): Palette {
  const p = PALETTES[name];
  if (!p) throw new Error(`Unknown palette: ${name}. Known: ${Object.keys(PALETTES).join(", ")}`);
  return p;
}

/**
 * Look up a named color within a palette, throwing if missing. Use this from
 * asset `build` functions so the type system stays happy under
 * `noUncheckedIndexedAccess` and missing colors fail loudly at render time.
 */
export function color(palette: Palette, name: string): string {
  const c = palette.colors[name];
  if (!c) throw new Error(`Palette "${palette.name}" has no color "${name}"`);
  return c;
}
