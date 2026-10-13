import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const g = await loadCases("glass-cases.ts");

/** Steps a spring toward `target` for `seconds` at `fps`, returns the trace of values. */
function run(config, { from = 0, target = 1, seconds = 3, fps = 60 } = {}) {
  const state = g.createSpring(from, target);
  const trace = [];
  for (let t = 0; t < seconds; t += 1 / fps) {
    g.stepSpring(state, config, 1 / fps);
    trace.push(state.value);
  }
  return { state, trace };
}

test("every named spring converges onto its target and comes to rest", () => {
  for (const [name, config] of Object.entries(g.SPRINGS)) {
    const { state } = run(config, { seconds: 4 });
    assert.ok(Math.abs(state.value - 1) < 1e-3, `${name} ends at ${state.value}`);
    assert.ok(g.isAtRest(state), `${name} still moves`);
  }
});

test("springs do not depend on the frame rate", () => {
  for (const name of ["snappy", "jelly"]) {
    const slow = run(g.SPRINGS[name], { seconds: 0.3, fps: 30 }).state.value;
    const fast = run(g.SPRINGS[name], { seconds: 0.3, fps: 240 }).state.value;
    assert.ok(Math.abs(slow - fast) < 0.02, `${name}: ${slow} vs ${fast}`);
  }
  // A frozen tab hands over a huge dt: it is bounded, not exploded.
  const state = g.createSpring(0, 1);
  g.stepSpring(state, g.SPRINGS.snappy, 60);
  assert.ok(Number.isFinite(state.value) && Math.abs(state.value) < 2);
});

test("the jelly springs overshoot and the mismatched squash pair wobbles out of step", () => {
  const peak = (config) => Math.max(...run(config).trace);
  assert.ok(peak(g.SPRINGS.jelly) > 1.05, "jelly overshoots");
  assert.ok(g.dampingRatio(g.SPRINGS.jelly) < 0.6);
  assert.ok(g.dampingRatio(g.SPRINGS.squashX) < g.dampingRatio(g.SPRINGS.squashY));
  assert.ok(Math.abs(g.dampingRatio(g.SPRINGS.squashX) - 0.6) < 1e-9);
  assert.ok(Math.abs(g.dampingRatio(g.SPRINGS.squashY) - 0.7) < 1e-9);
  const x = run(g.SPRINGS.squashX).trace;
  const y = run(g.SPRINGS.squashY).trace;
  assert.ok(
    x.some((v, i) => Math.abs(v - y[i]) > 0.02),
    "the two axes are not in phase",
  );
  // A critically damped spring never overshoots.
  assert.ok(peak({ stiffness: 400, damping: g.dampingFor(1, 400) }) <= 1.0001);
});

test("a spring released with a velocity keeps going and settles on the new target", () => {
  const state = g.createSpring(0, 0);
  state.velocity = 500;
  for (let i = 0; i < 600; i++) g.stepSpring(state, g.SPRINGS.jelly, 1 / 60);
  assert.ok(Math.abs(state.value) < 1e-3);
  g.settle(state);
  assert.deepEqual([state.value, state.velocity], [0, 0]);
});

test("the squash stays within 20% per axis, stretches along the motion and squashes across it", () => {
  assert.deepEqual(g.squashTarget(0, 0), { x: 1, y: 1 });
  const right = g.squashTarget(900, 0);
  assert.ok(right.x > 1 && right.y < 1);
  const down = g.squashTarget(0, -900);
  assert.ok(down.y > 1 && down.x < 1);
  for (const v of [
    [5000, 0],
    [0, 5000],
    [4000, 4000],
    [-9000, 100],
  ]) {
    const { x, y } = g.squashTarget(...v);
    for (const s of [x, y]) assert.ok(s >= 0.8 - 1e-9 && s <= 1.25 + 1e-9, `${v}: ${s}`);
  }
});

test("the rubber band follows the pointer near the origin and never passes its limit", () => {
  assert.equal(g.rubberBand(0, 48), 0);
  assert.ok(Math.abs(g.rubberBand(2, 48) - 2) < 0.01);
  let last = 0;
  for (const d of [10, 50, 100, 400, 4000]) {
    const v = g.rubberBand(d, 48);
    assert.ok(v > last && v <= 48, `${d} -> ${v}`);
    last = v;
  }
});
