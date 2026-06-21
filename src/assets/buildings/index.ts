// Building asset specs. Authored in 0..100 viewBox; renderer scales to px.
import { color } from "../../lib/palette";
import { g, polygon, rect } from "../../lib/primitives";
import { registerAll } from "../../lib/registry";
import type { AssetSpec, SvgNode } from "../../lib/types";

const castle: AssetSpec = {
  id: "buildings/castle",
  category: "buildings",
  label: "Castle",
  palette: "buildings",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    const battlements: SvgNode[] = [];
    for (let x = 20; x < 80; x += 8) {
      battlements.push(rect(x, 18, 5, 6, c("stone")));
    }
    const towers = [
      g("translate(12,0)", [
        rect(0, 30, 14, 50, c("stoneDark")),
        ...[0, 4, 8].map((dy) => rect(2, 38 + dy, 4, 5, c("window"))),
        polygon(
          [
            [0, 30],
            [14, 30],
            [7, 18],
          ],
          c("roof"),
        ),
      ]),
      g("translate(74,0)", [
        rect(0, 30, 14, 50, c("stoneDark")),
        ...[0, 4, 8].map((dy) => rect(8, 38 + dy, 4, 5, c("window"))),
        polygon(
          [
            [0, 30],
            [14, 30],
            [7, 18],
          ],
          c("roof"),
        ),
      ]),
    ];
    return g(undefined, [
      rect(0, 0, 100, 100, "#6abe30"),
      // Walls
      rect(18, 24, 64, 56, c("wall")),
      rect(18, 24, 64, 4, c("wallDark")),
      ...battlements,
      // Gate
      rect(44, 58, 12, 22, c("door")),
      polygon(
        [
          [44, 58],
          [56, 58],
          [50, 50],
        ],
        c("door"),
      ),
      // Towers
      ...towers,
      // Flag
      g("translate(50,18)", [
        rect(0, 0, 1, 12, c("flagPole")),
        polygon(
          [
            [1, 1],
            [10, 4],
            [1, 7],
          ],
          c("flag"),
        ),
      ]),
    ]);
  },
};

const town: AssetSpec = {
  id: "buildings/town",
  category: "buildings",
  label: "Town (cluster of houses)",
  palette: "buildings",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    const house = (ox: number, oy: number, roofColor: string): SvgNode =>
      g(`translate(${ox},${oy})`, [
        rect(0, 14, 18, 14, c("wood")),
        polygon(
          [
            [0, 14],
            [18, 14],
            [9, 4],
          ],
          roofColor,
        ),
        rect(6, 20, 6, 8, c("door")),
        rect(2, 16, 3, 3, c("window")),
        rect(13, 16, 3, 3, c("window")),
      ]);
    return g(undefined, [
      rect(0, 0, 100, 100, "#6abe30"),
      rect(10, 70, 80, 20, c("road")),
      house(15, 50, c("roof")),
      house(45, 50, c("roofDark")),
      house(70, 50, c("roof")),
      house(30, 30, c("roofDark")),
      house(60, 30, c("roof")),
    ]);
  },
};

const farmland: AssetSpec = {
  id: "buildings/farmland",
  category: "buildings",
  label: "Farmland (tilled fields)",
  palette: "buildings",
  build: (ctx) => {
    const c = (name: string) => color(ctx.palette, name);
    const furrows: SvgNode[] = [];
    for (let y = 22; y < 92; y += 6) {
      furrows.push(rect(12, y, 76, 2, c("fieldDark")));
    }
    return g(undefined, [
      rect(0, 0, 100, 100, "#6abe30"),
      rect(10, 18, 80, 76, c("field")),
      ...furrows,
      // Small barn
      g("translate(40,2)", [
        rect(0, 8, 20, 12, c("wood")),
        polygon(
          [
            [0, 8],
            [20, 8],
            [10, 0],
          ],
          c("roof"),
        ),
        rect(8, 14, 4, 6, c("door")),
      ]),
    ]);
  },
};

registerAll([castle, town, farmland]);
