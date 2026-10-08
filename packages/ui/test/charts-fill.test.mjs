// Pure sizing helpers behind "fill the parent": drawing height and stretched timeline lanes.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const bundle = await build({
  stdin: {
    contents: [
      "core/drawing-height.ts",
      "timeline-chart/timeline-lanes.ts",
      "waterfall-chart/waterfall-layout.ts",
    ]
      .map((file) => `export * from ${JSON.stringify(join(charts, file))};`)
      .join("\n"),
    resolveDir: charts,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("fill takes the measured height, a number stays, a ratio derives from the width", () => {
  assert.equal(lib.resolveDrawingHeight({ height: "fill", width: 600, measured: 333.7 }), 333);
  assert.equal(lib.resolveDrawingHeight({ height: 300, width: 600, measured: 10 }), 300);
  assert.equal(
    lib.resolveDrawingHeight({ height: 300, aspectRatio: 2, width: 600, measured: 10 }),
    300,
  );
  assert.equal(
    lib.resolveDrawingHeight({ height: "fill", aspectRatio: 2, width: 600, measured: 200 }),
    200,
  );
  assert.equal(
    lib.resolveDrawingHeight({ height: (width) => width / 4, width: 600, measured: 0 }),
    150,
  );
  assert.equal(lib.resolveDrawingHeight({ height: "fill", width: 600, measured: 5 }), 40);
});

test("stretched timeline lanes make the rows fill the available height exactly", () => {
  const counts = [1, 2, 1];
  const gap = 3;
  const rowPad = 8;
  const available = 300;
  const lane = lib.fitLaneHeight({ counts, available, gap, rowPad });
  const total = counts.reduce((sum, count) => sum + count * (lane + gap) - gap + rowPad * 2, 0);
  assert.ok(Math.abs(total - available) < 1e-9, `${total} != ${available}`);
  assert.equal(lib.fitLaneHeight({ counts, available: 10, gap, rowPad }), 14);
  assert.equal(lib.fitLaneHeight({ counts, available: 5000, gap, rowPad }), 72);
});

test("waterfall labels wider than their bar show unless a neighbour really collides", () => {
  // 60px labels on a 50px step: the staggered ones fit, the level ones do not.
  const boxes = [
    { center: 25, width: 60, y: 200 },
    { center: 75, width: 60, y: 120 },
    { center: 125, width: 60, y: 118 },
    { center: 175, width: 60, y: 40 },
  ];
  assert.deepEqual(lib.pickLabels(boxes), [true, true, false, true]);
  assert.deepEqual(
    lib.pickLabels([
      { center: 0, width: 30, y: 10 },
      { center: 100, width: 30, y: 10 },
    ]),
    [true, true],
  );
});
