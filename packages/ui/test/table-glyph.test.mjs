import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html, glyphLayout, squareSideCounts, rectSideCounts } =
  await loadCases("floor-plan-cases.tsx");

const sideOf = (chair, w, h) => {
  if (chair.rotate === 0) return chair.cy < h / 2 ? "top" : "bottom";
  return chair.cx < w / 2 ? "left" : "right";
};

const tally = (layout) => {
  const out = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const chair of layout.chairs) out[sideOf(chair, layout.width, layout.height)] += 1;
  return out;
};

test("square tables take one chair per side up to four, then spread with the remainder first", () => {
  const cases = [
    [1, { top: 1, bottom: 0, left: 0, right: 0 }],
    [2, { top: 1, bottom: 1, left: 0, right: 0 }],
    [3, { top: 1, bottom: 1, left: 1, right: 0 }],
    [4, { top: 1, bottom: 1, left: 1, right: 1 }],
    [5, { top: 2, bottom: 1, left: 1, right: 1 }],
    [6, { top: 2, bottom: 2, left: 1, right: 1 }],
    [8, { top: 2, bottom: 2, left: 2, right: 2 }],
    [10, { top: 3, bottom: 3, left: 2, right: 2 }],
  ];
  for (const [seats, expected] of cases) {
    assert.deepEqual(squareSideCounts(seats), expected, `${seats} seats`);
    assert.deepEqual(tally(glyphLayout("square", seats, 100, 100)), expected, `${seats} drawn`);
  }
});

test("rect tables seat one at each end and split the rest along the long sides", () => {
  const cases = [
    [1, { left: 1, right: 0, top: 0, bottom: 0 }],
    [2, { left: 1, right: 1, top: 0, bottom: 0 }],
    [3, { left: 1, right: 1, top: 1, bottom: 0 }],
    [4, { left: 1, right: 1, top: 1, bottom: 1 }],
    [6, { left: 1, right: 1, top: 2, bottom: 2 }],
    [7, { left: 1, right: 1, top: 3, bottom: 2 }],
  ];
  for (const [seats, expected] of cases) {
    assert.deepEqual(rectSideCounts(seats), expected, `${seats} seats`);
    assert.deepEqual(tally(glyphLayout("rect", seats, 200, 100)), expected, `${seats} drawn`);
  }
});

test("chairs along a rect side are evenly spaced and symmetric", () => {
  const layout = glyphLayout("rect", 8, 300, 100);
  const top = layout.chairs.filter((c) => c.rotate === 0 && c.cy < 50).map((c) => c.cx);
  assert.equal(top.length, 3);
  const gaps = top.slice(1).map((x, i) => x - top[i]);
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-9);
  assert.ok(Math.abs(top[0] - (300 - top[2])) < 1e-9);
});

test("a tall rect is the same layout turned a quarter", () => {
  const wide = glyphLayout("rect", 6, 200, 100);
  const tall = glyphLayout("rect", 6, 100, 200);
  assert.equal(tall.chairs.length, 6);
  assert.deepEqual(tally(tall), { top: 1, bottom: 1, left: 2, right: 2 });
  assert.equal(wide.chairs.filter((c) => c.rotate === 90).length, 2);
  assert.equal(tall.chairs.filter((c) => c.rotate === 0).length, 2);
});

test("round tables place chairs radially on one orbit, evenly, first at the top", () => {
  const layout = glyphLayout("round", 6, 300, 300);
  const radii = layout.chairs.map((c) => Math.hypot(c.cx - 150, c.cy - 150));
  for (const r of radii) assert.ok(Math.abs(r - radii[0]) < 1e-9);
  assert.ok(Math.abs(layout.chairs[0].cx - 150) < 1e-9);
  assert.ok(layout.chairs[0].cy < 150);
  const step = (angle) => ((angle % 360) + 360) % 360;
  const a0 = step(layout.chairs[0].rotate);
  const a1 = step(layout.chairs[1].rotate);
  assert.ok(Math.abs(step(a1 - a0) - 60) < 1e-9);
  assert.ok(layout.body.round);
});

test("bar tables line stools up in one row below the counter", () => {
  const layout = glyphLayout("bar", 4, 400, 100);
  assert.equal(layout.chairs.length, 4);
  assert.ok(layout.chairs.every((c) => c.circle && c.cy === layout.chairs[0].cy));
  assert.ok(layout.chairs[0].cy > layout.body.y + layout.body.height);
  const xs = layout.chairs.map((c) => c.cx);
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]));
});

test("every chair stays inside the box", () => {
  for (const shape of ["round", "square", "rect", "bar"]) {
    for (const seats of [1, 2, 3, 5, 8, 12]) {
      for (const [w, h] of [
        [100, 100],
        [200, 100],
        [100, 300],
      ]) {
        const layout = glyphLayout(shape, seats, w, h);
        assert.equal(layout.chairs.length, seats, `${shape} ${seats}`);
        for (const c of layout.chairs) {
          const turned = c.rotate % 180 !== 0 && !c.circle;
          const half = (turned ? c.height : c.width) / 2;
          const halfY = (turned ? c.width : c.height) / 2;
          const tilted = shape === "round";
          if (tilted) continue;
          assert.ok(c.cx - half >= -1e-9 && c.cx + half <= w + 1e-9, `${shape} ${seats} x`);
          assert.ok(c.cy - halfY >= -1e-9 && c.cy + halfY <= h + 1e-9, `${shape} ${seats} y`);
        }
      }
    }
  }
});

test("occupied fills that many chairs, clamped to the seat count", () => {
  const three = html.glyph({ shape: "square", seats: 4, occupied: 3 });
  assert.equal(three.match(/data-part="chair" data-occupied=""/g)?.length, 3);
  assert.match(three, /data-occupied="3"/);
  assert.equal(
    html.glyph({ shape: "round", seats: 2, occupied: 9 }).match(/data-occupied=""/g)?.length,
    2,
  );
  assert.doesNotMatch(
    html.glyph({ shape: "round", seats: 2 }),
    /data-part="chair" data-occupied=""/,
  );
});

test("decorative by default, labelled as an image when given an aria-label", () => {
  assert.match(html.glyph({ shape: "round", seats: 4 }), /aria-hidden="true"/);
  assert.doesNotMatch(html.glyph({ shape: "round", seats: 4 }), /role=/);
  const labelled = html.glyph({ shape: "round", seats: 4, "aria-label": "Table 4, round" });
  assert.match(labelled, /role="img"/);
  assert.match(labelled, /aria-label="Table 4, round"/);
  assert.doesNotMatch(labelled, /aria-hidden/);
});

test("draws with currentColor and tokens only, with a token size", () => {
  const markup = html.glyph({ shape: "rect", seats: 6, size: "md" });
  assert.match(markup, /h-control-lg/);
  assert.match(markup, /fill-surface/);
  assert.match(markup, /stroke-current/);
  assert.doesNotMatch(markup, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
  assert.match(html.glyph({ shape: "bar", seats: 3, size: "fill" }), /size-full/);
});
