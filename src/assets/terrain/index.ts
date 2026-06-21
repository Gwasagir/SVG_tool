// Terrain asset specs. Authored in 0..100 viewBox; renderer scales to px.
import { color } from "../../lib/palette";
import { circle, defs, g, linearGradient, polygon, rect } from "../../lib/primitives";
import { registerAll } from "../../lib/registry";
import type { AssetSpec, SvgNode } from "../../lib/types";

const grass: AssetSpec = {
  id: "terrain/grass",
  category: "terrain",
  label: "Grass tile",
  palette: "terrain",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    const blades: SvgNode[] = [];
    for (let i = 0; i < 18; i++) {
      const x = 8 + ctx.rng() * 84;
      const y = 8 + ctx.rng() * 84;
      const h = 3 + ctx.rng() * 4;
      blades.push(
        polygon(
          [
            [x, y],
            [x - 1, y + h],
            [x + 1, y + h],
          ],
          c("grassDark"),
        ),
      );
    }
    return g(undefined, [rect(0, 0, 100, 100, c("grass")), ...blades]);
  },
};

const forest: AssetSpec = {
  id: "terrain/forest",
  category: "terrain",
  label: "Forest tile",
  palette: "terrain",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    const trees: SvgNode[] = [];
    const pos: Array<[number, number]> = [
      [25, 30],
      [70, 25],
      [50, 60],
      [20, 75],
      [78, 72],
    ];
    for (const [x, y] of pos) {
      trees.push(
        g(undefined, [
          rect(x - 2, y + 8, 4, 6, c("forestDark")),
          circle(x, y, 11, c("forest")),
          circle(x - 3, y - 2, 6, c("forestDark")),
        ]),
      );
    }
    return g(undefined, [rect(0, 0, 100, 100, c("grassDark")), ...trees]);
  },
};

const water: AssetSpec = {
  id: "terrain/water",
  category: "terrain",
  label: "Water tile",
  palette: "terrain",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      defs([
        linearGradient("waterGrad", [
          [0, c("water")],
          [1, c("waterDark")],
        ]),
        linearGradient("waterSheen", [
          [0, "rgba(255,255,255,0.15)"],
          [1, "rgba(255,255,255,0)"],
        ]),
      ]),
      rect(0, 0, 100, 100, "url(#waterGrad)"),
      rect(0, 0, 100, 100, "url(#waterSheen)"),
      polygon(
        [
          [10, 35],
          [40, 33],
          [70, 36],
        ],
        c("waterLight"),
        { fill: "none", stroke: c("waterLight"), "stroke-width": 1.5, opacity: 0.5 },
      ),
      polygon(
        [
          [15, 65],
          [50, 63],
          [85, 66],
        ],
        c("waterLight"),
        { fill: "none", stroke: c("waterLight"), "stroke-width": 1.5, opacity: 0.4 },
      ),
    ]);
  },
};

const mountain: AssetSpec = {
  id: "terrain/mountain",
  category: "terrain",
  label: "Mountain tile",
  palette: "terrain",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(0, 0, 100, 100, c("grass")),
      polygon(
        [
          [50, 8],
          [88, 88],
          [12, 88],
        ],
        c("mountain"),
      ),
      polygon(
        [
          [50, 8],
          [70, 50],
          [30, 50],
        ],
        c("mountainDark"),
      ),
      polygon(
        [
          [50, 8],
          [58, 26],
          [42, 26],
        ],
        c("mountainSnow"),
      ),
    ]);
  },
};

const road: AssetSpec = {
  id: "terrain/road",
  category: "terrain",
  label: "Road tile",
  palette: "terrain",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    return g(undefined, [
      rect(0, 0, 100, 100, c("grass")),
      polygon(
        [
          [35, 0],
          [65, 0],
          [60, 100],
          [40, 100],
        ],
        c("road"),
      ),
      polygon(
        [
          [35, 0],
          [40, 0],
          [37, 100],
          [33, 100],
        ],
        c("roadDark"),
        { opacity: 0.6 },
      ),
      polygon(
        [
          [60, 0],
          [65, 0],
          [67, 100],
          [63, 100],
        ],
        c("roadDark"),
        { opacity: 0.6 },
      ),
    ]);
  },
};

registerAll([grass, forest, water, mountain, road]);
