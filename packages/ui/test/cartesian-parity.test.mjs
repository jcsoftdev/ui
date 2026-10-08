// Pure logic added for cartesian parity: step curves, LTTB downsampling, chart sync store.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "../src/charts/core");

const bundle = await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(join(core, "path.ts"))};`,
      `export * from ${JSON.stringify(join(core, "downsample.ts"))};`,
      `export * from ${JSON.stringify(join(core, "cartesian/sync-store.ts"))};`,
      `export * from ${JSON.stringify(join(core, "cartesian/axis-stack.ts"))};`,
    ].join("\n"),
    resolveDir: core,
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

const pts = [
  { x: 0, y: 10 },
  { x: 10, y: 20 },
  { x: 20, y: 5 },
];

test("step curves hold the value until the change", () => {
  assert.equal(lib.linePath(pts, "step-after"), "M0,10H10V20H20V5");
  assert.equal(lib.linePath(pts, "step-before"), "M0,10V20H10V5H20");
  assert.equal(lib.linePath(pts, "step"), "M0,10H5V20H10H15V5H20");
});

test("step curves keep gaps and need no minimum of three points", () => {
  assert.equal(lib.linePath([pts[0], null, pts[2]], "step"), "M0,10M20,5");
  assert.equal(lib.linePath(pts.slice(0, 2), "step-after"), "M0,10H10V20");
});

test("areaPath walks the lower edge with the mirrored step", () => {
  const bottom = pts.map((p) => ({ x: p.x, y: 0 }));
  assert.equal(lib.areaPath(pts, bottom, "step-after"), "M0,10H10V20H20V5L20,0V0H10V0H0Z");
});

test("lttbIndices keeps first and last, stays ascending and respects the threshold", () => {
  const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.sin(i / 20) * 50 }));
  const kept = lib.lttbIndices(points, 100);
  assert.equal(kept.length, 100);
  assert.equal(kept[0], 0);
  assert.equal(kept[99], 999);
  for (let i = 1; i < kept.length; i += 1) assert.ok(kept[i] > kept[i - 1]);
});

test("lttbIndices keeps a lone spike that averaging would flatten", () => {
  const points = Array.from({ length: 500 }, (_, i) => ({ x: i, y: i === 250 ? 1000 : 0 }));
  assert.ok(lib.lttbIndices(points, 50).includes(250));
});

test("downsample returns the input when it is already small", () => {
  assert.deepEqual(lib.downsample(pts, 10), pts);
  assert.deepEqual(lib.lttbIndices(pts, 2), [0, 1, 2]);
});

test("sharedSampleIndices aligns series and never bridges a gap", () => {
  const a = Array.from({ length: 400 }, (_, i) => (i >= 100 && i < 110 ? null : Math.sin(i / 9)));
  const b = Array.from({ length: 400 }, (_, i) => Math.cos(i / 7));
  assert.equal(lib.sharedSampleIndices([a, b], 500), null);
  const kept = lib.sharedSampleIndices([a, b], 60);
  assert.ok(kept.length >= 60 && kept.length <= 125);
  assert.ok(kept.includes(99) && kept.includes(110), "neighbours of the gap survive");
  assert.equal(kept[0], 0);
  assert.equal(kept[kept.length - 1], 399);
  assert.deepEqual(
    [...kept].sort((x, y) => x - y),
    kept,
  );
});

test("sync store: only the owner clears the hover; equal ranges do not notify", () => {
  const store = new lib.ChartSyncStore();
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.setHover("g", 5, "a");
  assert.equal(store.get("g").hover, 5);
  store.clearHover("g", "b");
  assert.equal(store.get("g").hover, 5);
  store.clearHover("g", "a");
  assert.equal(store.get("g").hover, null);
  store.setRange("g", [1, 4]);
  const before = calls;
  store.setRange("g", [1, 4]);
  assert.equal(calls, before);
  assert.equal(store.get("other").hover, null);
});

test("syncKeyOf identifies dates by time", () => {
  assert.equal(lib.syncKeyOf(new Date(2026, 9, 8)), +new Date(2026, 9, 8));
  assert.equal(lib.syncKeyOf("lun"), "lun");
});

test("stackAxes: axes hang outward on their side and margins add up", () => {
  const stacked = lib.stackAxes(
    [
      { id: "ventas", side: "left", width: 50 },
      { id: "clientes", side: "right", width: 30 },
      { id: "ticket", side: "right", width: 40 },
      { id: "extra", side: "left", width: 24 },
    ],
    { minLeft: 20, rightFallback: 8 },
  );
  assert.equal(stacked.left, 74);
  assert.equal(stacked.right, 70);
  assert.deepEqual(Object.fromEntries(stacked.offsets), {
    ventas: 0,
    clientes: 0,
    ticket: 30,
    extra: 50,
  });
});

test("stackAxes: no right axis falls back, tiny left labels keep the minimum", () => {
  const stacked = lib.stackAxes([{ id: "left", side: "left", width: 12 }], {
    minLeft: 20,
    rightFallback: 9,
  });
  assert.equal(stacked.left, 20);
  assert.equal(stacked.right, 9);
});

test("resolveAxes: left/right are sugar, extra axes merge or append, unused axes drop", () => {
  const used = new Set(["left", "right", "ticket"]);
  const axes = lib.resolveAxes(
    { title: "S/" },
    { title: "Citas" },
    [{ id: "right", color: "red" }, { id: "ticket", title: "Ticket" }, { id: "nadie" }],
    used,
  );
  assert.deepEqual(
    axes.map((axis) => [axis.id, axis.side]),
    [
      ["left", "left"],
      ["right", "right"],
      ["ticket", "right"],
    ],
  );
  assert.equal(axes[1].options.title, "Citas");
  assert.equal(axes[1].color, "red");
  assert.equal(axes[2].options.title, "Ticket");
});

test("resolveAxes: the left axis is dropped when only other axes are used, kept when nothing is", () => {
  assert.deepEqual(
    lib.resolveAxes({}, {}, [], new Set(["right"])).map((axis) => axis.id),
    ["right"],
  );
  assert.deepEqual(
    lib.resolveAxes({}, {}, [], new Set()).map((axis) => axis.id),
    ["left"],
  );
});

test("sync store: the group margin is the widest one and shrinks when a chart leaves", () => {
  const store = new lib.ChartSyncStore();
  store.setMargin("g", "a", { left: 40, right: 10 });
  store.setMargin("g", "b", { left: 62, right: 8 });
  assert.deepEqual(store.get("g").margin, { left: 62, right: 10 });
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.setMargin("g", "b", { left: 62, right: 8 });
  assert.equal(calls, 0);
  store.setMargin("g", "b", null);
  assert.deepEqual(store.get("g").margin, { left: 40, right: 10 });
  store.setMargin("g", "a", null);
  assert.equal(store.get("g").margin, null);
});
