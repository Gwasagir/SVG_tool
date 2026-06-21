// Unit asset specs — simple figurine-style markers. Authored in 0..100 viewBox.
import { color } from "../../lib/palette";
import { path, g, line, polygon, rect } from "../../lib/primitives";
import { registerAll } from "../../lib/registry";
import type { AssetSpec } from "../../lib/types";

const archer: AssetSpec = {
  id: "units/archer",
  category: "units",
  label: "Archer (a figure holding a bow)",
  palette: "units",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(0, 0, 100, 100, "rgba(0,0,0,0)"),
      // Body (cloak)
      polygon(
        [
          [40, 40],
          [60, 40],
          [64, 80],
          [36, 80],
        ],
        c("cloak"),
      ),
      // Head
      g("translate(50,32)", [circle0(0, 0, 8, c("skinTone")), circle0(-2, -2, 3, c("bodyDark"))]),
      // Bow — arc on the right
      path("M 68 44 Q 80 60 68 76", {
        fill: "none",
        stroke: c("bow"),
        "stroke-width": 2.5,
        "stroke-linecap": "round",
      }),
      // Bowstring
      line(68, 44, 68, 76, c("bowstring"), { "stroke-width": 1 }),
      // Arrow (nocked, pointing left)
      line(62, 60, 30, 60, c("arrow"), { "stroke-width": 1.5 }),
      polygon(
        [
          [30, 60],
          [36, 58],
          [36, 62],
        ],
        c("weapon"),
      ),
      // Quiver strap
      line(40, 44, 50, 40, c("bodyDark"), { "stroke-width": 1.5 }),
    ]);
  },
};

const knight: AssetSpec = {
  id: "units/knight",
  category: "units",
  label: "Knight (armored figure with shield)",
  palette: "units",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(0, 0, 100, 100, "rgba(0,0,0,0)"),
      // Body (armor)
      polygon(
        [
          [40, 40],
          [60, 40],
          [62, 82],
          [38, 82],
        ],
        c("armor"),
      ),
      polygon(
        [
          [40, 40],
          [60, 40],
          [58, 50],
          [42, 50],
        ],
        c("armorDark"),
      ),
      // Helmet
      g("translate(50,30)", [
        circle0(0, 0, 9, c("armor")),
        rect(-9, -2, 18, 4, c("armorDark")),
        rect(-2, 2, 4, 5, c("armorDark")),
      ]),
      // Shield (left arm)
      polygon(
        [
          [28, 50],
          [40, 50],
          [38, 72],
          [30, 72],
        ],
        c("shield"),
      ),
      polygon(
        [
          [30, 54],
          [38, 54],
          [37, 70],
          [31, 70],
        ],
        c("shieldTrim"),
      ),
      // Sword (right arm, raised)
      line(64, 44, 78, 20, c("weaponMetal"), { "stroke-width": 2.5 }),
      line(60, 44, 68, 40, c("weapon"), { "stroke-width": 2 }),
    ]);
  },
};

// Tiny helper — a circle with no opts, used inline above.
function circle0(cx: number, cy: number, r: number, fill: string) {
  return { tag: "circle" as const, attrs: { cx, cy, r, fill } };
}

registerAll([archer, knight]);
