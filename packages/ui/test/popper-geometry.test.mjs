// DOM-free placement maths for the popper: sides, alignment, offsets, flip, shift, RTL, arrow.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/primitives/popper/geometry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { computePlacement, intersectRects, normalizePadding } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const boundary = { x: 0, y: 0, width: 1000, height: 800 };
const anchor = { x: 400, y: 300, width: 100, height: 40 };
const content = { width: 200, height: 100 };
const base = { anchor, content, boundary };

const place = (extra) => computePlacement({ ...base, ...extra });

test("side x align table places the content around the anchor", () => {
  const rows = [
    // side, align, x, y
    ["bottom", "start", 400, 340],
    ["bottom", "center", 350, 340],
    ["bottom", "end", 300, 340],
    ["top", "start", 400, 200],
    ["top", "center", 350, 200],
    ["top", "end", 300, 200],
    ["right", "start", 500, 300],
    ["right", "center", 500, 270],
    ["right", "end", 500, 240],
    ["left", "start", 200, 300],
    ["left", "center", 200, 270],
    ["left", "end", 200, 240],
  ];
  for (const [side, align, x, y] of rows) {
    const result = place({ side, align });
    assert.deepEqual(
      [result.side, result.align, result.x, result.y],
      [side, align, x, y],
      `${side}/${align}`,
    );
  }
});

test("sideOffset pushes away from the anchor, alignOffset along the edge", () => {
  assert.deepEqual(
    (({ x, y }) => ({ x, y }))(
      place({ side: "bottom", align: "start", sideOffset: 8, alignOffset: 12 }),
    ),
    { x: 412, y: 348 },
  );
  assert.deepEqual(
    (({ x, y }) => ({ x, y }))(
      place({ side: "right", align: "start", sideOffset: 8, alignOffset: 12 }),
    ),
    { x: 508, y: 312 },
  );
  // `end` moves the other way so the offset always means "away from the edge".
  assert.equal(place({ side: "bottom", align: "end", alignOffset: 10 }).x, 290);
});

test("flips to the opposite side only when it overflows and the other fits better", () => {
  const nearBottom = { anchor: { x: 400, y: 740, width: 100, height: 40 } };
  const flipped = place({ ...nearBottom, side: "bottom" });
  assert.equal(flipped.side, "top");
  assert.equal(flipped.y, 740 - 100);
  assert.equal(place({ ...nearBottom, side: "bottom", avoidCollisions: false }).side, "bottom");
  // Neither side fits: keep the one with less overflow (the preferred bottom here).
  const tall = place({
    content: { width: 200, height: 700 },
    side: "bottom",
    anchor: { x: 400, y: 400, width: 100, height: 40 },
  });
  assert.equal(tall.side, "top");
  const stays = place({
    content: { width: 200, height: 700 },
    side: "bottom",
    anchor: { x: 400, y: 300, width: 100, height: 40 },
  });
  assert.equal(stays.side, "bottom");
});

test("flip respects collision padding", () => {
  const nearEdge = { anchor: { x: 400, y: 640, width: 100, height: 40 } };
  assert.equal(place({ ...nearEdge, side: "bottom" }).side, "bottom"); // 680..780 fits in 800
  assert.equal(place({ ...nearEdge, side: "bottom", collisionPadding: 30 }).side, "top");
  assert.equal(
    place({ ...nearEdge, side: "bottom", collisionPadding: { top: 0, bottom: 30 } }).side,
    "top",
  );
});

test("shifts along the edge to stay inside the boundary", () => {
  const right = place({
    side: "bottom",
    align: "center",
    anchor: { x: 930, y: 300, width: 60, height: 40 },
  });
  assert.equal(right.x, 800); // 1000 - 200
  const left = place({
    side: "bottom",
    align: "center",
    anchor: { x: 10, y: 300, width: 60, height: 40 },
    collisionPadding: 8,
  });
  assert.equal(left.x, 8);
  const vertical = place({
    side: "right",
    align: "center",
    anchor: { x: 400, y: 5, width: 100, height: 20 },
  });
  assert.equal(vertical.y, 0);
  assert.equal(
    place({
      side: "bottom",
      anchor: { x: 930, y: 300, width: 60, height: 40 },
      avoidCollisions: false,
    }).x,
    860,
  );
});

test("partial sticky keeps the content touching the anchor, always lets it leave", () => {
  const input = {
    boundary: { x: 500, y: 0, width: 100, height: 800 },
    content: { width: 50, height: 50 },
    anchor: { x: 0, y: 300, width: 20, height: 20 },
    side: "bottom",
  };
  assert.equal(place({ ...input, sticky: "partial" }).x, 20);
  assert.equal(place({ ...input, sticky: "always" }).x, 500);
});

test("small viewport: content larger than the boundary pins to the start edge", () => {
  const result = place({
    boundary: { x: 0, y: 0, width: 150, height: 600 },
    anchor: { x: 60, y: 200, width: 30, height: 30 },
    side: "bottom",
  });
  assert.equal(result.x, 0);
  assert.equal(result.availableWidth, 150);
});

test("RTL: start and end follow the reading direction", () => {
  const rtl = (extra) => place({ dir: "rtl", ...extra });
  assert.equal(rtl({ side: "bottom", align: "start" }).x, 300); // right edges flush: 500 - 200
  assert.equal(rtl({ side: "bottom", align: "end" }).x, 400);
  assert.equal(rtl({ side: "bottom", align: "start", alignOffset: 10 }).x, 290);
  assert.equal(rtl({ side: "bottom", align: "end", alignOffset: 10 }).x, 410);
  // alignOffset has no meaning when centred.
  assert.equal(rtl({ side: "bottom", align: "center", alignOffset: 10 }).x, 350);
  assert.equal(place({ side: "bottom", align: "center", alignOffset: 10 }).x, 350);
  // The vertical axis does not depend on direction.
  assert.equal(rtl({ side: "right", align: "start" }).y, 300);
});

test("available size is the free space on the placed side", () => {
  const bottom = place({ side: "bottom", sideOffset: 10, collisionPadding: 8 });
  assert.equal(bottom.availableHeight, 800 - 8 - (340 + 10));
  assert.equal(bottom.availableWidth, 1000 - 16);
  const top = place({ side: "top", sideOffset: 10, collisionPadding: 8 });
  assert.equal(top.availableHeight, 300 - 10 - 8);
  const right = place({ side: "right", sideOffset: 10 });
  assert.equal(right.availableWidth, 1000 - (500 + 10));
  const left = place({ side: "left", sideOffset: 10 });
  assert.equal(left.availableWidth, 400 - 10);
});

test("transform origin points at the anchor centre and reports the placed side", () => {
  assert.equal(place({ side: "bottom", align: "start" }).transformOrigin, "50px 0px");
  assert.equal(place({ side: "top", align: "start" }).transformOrigin, "50px 100px");
  assert.equal(place({ side: "right", align: "start" }).transformOrigin, "0px 20px");
  assert.equal(place({ side: "left", align: "start" }).transformOrigin, "200px 20px");
});

test("arrow: adds its height to the offset, centres on the anchor and clamps to the corners", () => {
  const arrow = { width: 10, height: 5, padding: 4 };
  const centred = place({ side: "bottom", align: "center", sideOffset: 6, arrow });
  assert.equal(centred.y, 340 + 6 + 5);
  assert.equal(centred.arrow.x, 100 - 5);
  assert.equal(centred.arrow.centerOffset, 0);
  const cornered = place({
    side: "bottom",
    align: "start",
    arrow: { ...arrow, padding: 4 },
    anchor: { x: 400, y: 300, width: 4, height: 40 },
  });
  assert.equal(cornered.arrow.x, 4);
  const shifted = place({
    side: "bottom",
    anchor: { x: 930, y: 300, width: 60, height: 40 },
    arrow,
  });
  assert.equal(shifted.x, 800);
  assert.equal(shifted.arrow.x, 960 - 800 - 5);
  assert.notEqual(shifted.arrow.centerOffset, 0);
  const side = place({
    side: "right",
    align: "start",
    arrow,
    anchor: { x: 400, y: 300, width: 100, height: 20 },
  });
  assert.equal(side.x, 500 + 5);
  assert.equal(side.arrow.y, 10 - 5);
  assert.equal(side.arrow.x, undefined);
});

test("anchor scrolled out of the boundary is reported as hidden", () => {
  assert.equal(place({}).anchorHidden, false);
  assert.equal(place({ anchor: { x: 400, y: -100, width: 100, height: 40 } }).anchorHidden, true);
  assert.equal(place({ anchor: { x: 400, y: 790, width: 100, height: 40 } }).anchorHidden, false);
});

test("helpers: padding normalisation and rect intersection", () => {
  assert.deepEqual(normalizePadding(4), { top: 4, right: 4, bottom: 4, left: 4 });
  assert.deepEqual(normalizePadding({ left: 3 }), { top: 0, right: 0, bottom: 0, left: 3 });
  assert.deepEqual(
    intersectRects([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 20, width: 100, height: 20 },
    ]),
    { x: 50, y: 20, width: 50, height: 20 },
  );
  assert.deepEqual(
    intersectRects([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 50, width: 10, height: 10 },
    ]),
    { x: 50, y: 50, width: 0, height: 0 },
  );
});

test("arrow is flagged to hide when it cannot point at the anchor centre", () => {
  const arrow = { width: 10, height: 5, padding: 4 };
  assert.equal(place({ side: "bottom", arrow }).arrow.shouldHide, false);
  const cornered = place({
    side: "bottom",
    align: "start",
    arrow,
    anchor: { x: 400, y: 300, width: 4, height: 40 },
  });
  assert.equal(cornered.arrow.shouldHide, true);
  const narrow = place({ side: "bottom", content: { width: 12, height: 40 }, arrow });
  assert.equal(narrow.arrow.shouldHide, true);
});

test("available size can go negative instead of clamping to zero", () => {
  const cramped = place({
    side: "bottom",
    anchor: { x: 400, y: 790, width: 100, height: 40 },
    avoidCollisions: false,
  });
  assert.ok(cramped.availableHeight < 0);
});
