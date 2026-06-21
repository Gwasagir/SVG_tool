// UI / icon asset specs.
import { color } from "../../lib/palette";
import { circle, g, polygon, rect } from "../../lib/primitives";
import { registerAll } from "../../lib/registry";
import type { AssetSpec } from "../../lib/types";

const button: AssetSpec = {
  id: "ui/button",
  category: "ui",
  label: "Generic beveled button",
  palette: "ui",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(6, 6, 88, 88, c("frameLight")),
      rect(10, 10, 80, 80, c("panel")),
      rect(10, 10, 80, 4, c("panelLight")),
      rect(10, 84, 80, 6, c("frame")),
    ]);
  },
};

const banner: AssetSpec = {
  id: "ui/banner",
  category: "ui",
  label: "Heraldic banner",
  palette: "ui",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(48, 4, 4, 30, c("bannerPole")),
      polygon(
        [
          [52, 10],
          [90, 16],
          [52, 40],
        ],
        c("red"),
      ),
      polygon(
        [
          [52, 22],
          [82, 25],
          [52, 32],
        ],
        c("gold"),
      ),
      circle(68, 25, 4, c("goldDark")),
    ]);
  },
};

const coin: AssetSpec = {
  id: "ui/coin",
  category: "ui",
  label: "Gold resource coin",
  palette: "ui",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      circle(50, 50, 42, c("goldDark")),
      circle(50, 50, 38, c("gold")),
      circle(50, 50, 32, c("goldDark"), {
        fill: "none",
        stroke: c("goldDark"),
        "stroke-width": 1.5,
      }),
      rect(48, 32, 4, 36, c("goldDark")),
    ]);
  },
};

registerAll([button, banner, coin]);
