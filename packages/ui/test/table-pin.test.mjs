// Pure helpers behind Table column pinning: cumulative sticky offsets and pin bookkeeping.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/containers/table/pin.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const widths = { name: 200, sku: 100, stock: 80, actions: 60 };

test("left columns stack from the left edge, right columns from the right edge", () => {
  const out = lib.computePinOffsets(widths, { left: ["name", "sku"], right: ["stock", "actions"] });
  assert.deepEqual(out.name, { side: "left", offset: 0, edge: false });
  assert.deepEqual(out.sku, { side: "left", offset: 200, edge: true });
  assert.deepEqual(out.actions, { side: "right", offset: 0, edge: false });
  assert.deepEqual(out.stock, { side: "right", offset: 60, edge: true });
});

test("unknown ids are ignored and left wins over right", () => {
  const out = lib.computePinOffsets(widths, { left: ["name", "gone"], right: ["name", "actions"] });
  assert.deepEqual(Object.keys(out).sort(), ["actions", "name"]);
  assert.equal(out.name.side, "left");
  assert.equal(out.actions.offset, 0);
});

test("setColumnPin moves a column between sides and keeps column order", () => {
  const order = ["name", "sku", "stock", "actions"];
  let pins = lib.setColumnPin({}, "sku", "left", order);
  pins = lib.setColumnPin(pins, "name", "left", order);
  assert.deepEqual(pins.left, ["name", "sku"]);
  pins = lib.setColumnPin(pins, "sku", "right", order);
  assert.deepEqual(pins, { left: ["name"], right: ["sku"] });
  pins = lib.setColumnPin(pins, "name", null, order);
  assert.deepEqual(pins, { left: [], right: ["sku"] });
});

test("sanitize and stored-pin parsing tolerate stale or corrupt data", () => {
  assert.deepEqual(lib.sanitizePinned({ left: ["a", "b"], right: ["b", "c"] }, ["a", "b"]), {
    left: ["a", "b"],
    right: [],
  });
  assert.equal(lib.parseStoredPins("not json"), null);
  assert.deepEqual(lib.parseStoredPins('{"left":["a",1],"right":"x"}'), {
    left: ["a"],
    right: [],
  });
});
