// Pure layout math of GaugeChart: fit, value block vs needle hub, end labels vs ticks.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/charts/gauge-chart/gauge-layout.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const { layoutGauge, showEndLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const base = {
  width: 560,
  height: 360,
  variant: "semi",
  mode: "progress",
  thickness: 18,
  endLabels: true,
  customCenter: false,
  caption: true,
  bandLabel: true,
  valueChars: 4,
};

test("tick labels replace the min/max end labels", () => {
  assert.equal(showEndLabels(true, 0), true);
  assert.equal(showEndLabels(true, 5), false);
  assert.equal(showEndLabels(false, 0), false);
});

test("the arc takes the largest size the box allows", () => {
  const wide = layoutGauge(base);
  assert.ok(wide.radius * 2 >= 560 - 2 * 12 - 12 - 1, `width-bound: ${wide.radius}`);
  const short = layoutGauge({ ...base, height: 200 });
  assert.ok(short.radius < wide.radius);
  for (const variant of ["semi", "three-quarter"]) {
    for (const mode of ["progress", "needle"]) {
      for (const [width, height] of [
        [560, 360],
        [320, 300],
        [700, 260],
      ]) {
        const l = layoutGauge({ ...base, variant, mode, width, height });
        assert.ok(l.cx - l.radius >= 0 && l.cx + l.radius <= width, "horizontal");
        if (l.radius > 40) assert.ok(l.cy - l.radius >= 0, `${variant}/${mode} top`);
      }
    }
  }
});

test("a growing box grows the arc until the width binds", () => {
  const a = layoutGauge({ ...base, height: 200 }).radius;
  const b = layoutGauge({ ...base, height: 260 }).radius;
  assert.ok(b > a);
});

test("three-quarter needle: the value block stays out of the needle sweep", () => {
  const l = layoutGauge({ ...base, variant: "three-quarter", mode: "needle", height: 320 });
  const halfWidth = (4 * 0.6 * l.valueSize) / 2;
  // The needle at the end of its travel runs along y = |x| below the hub.
  assert.ok(l.blockTop >= halfWidth + 8, `top ${l.blockTop} vs half width ${halfWidth}`);
  assert.ok(l.blockTop > 8, "below the hub");
  assert.ok(l.cy + l.labelDy <= 320, "inside the box");
});

test("semicircle needle keeps the value under the hub", () => {
  const l = layoutGauge({ ...base, mode: "needle" });
  assert.ok(l.blockTop > 8);
  assert.ok(l.valueDy > l.blockTop);
});

test("long values shrink to stay inside the arc", () => {
  for (const variant of ["semi", "three-quarter"]) {
    const layout = layoutGauge({ ...base, variant, valueChars: 11 });
    const textWidth = 11 * 0.6 * layout.valueSize;
    assert.ok(textWidth <= (layout.radius - layout.band) * 2 - 16, `${variant}: ${textWidth}`);
  }
  const narrow = { ...base, width: 320 };
  assert.ok(layoutGauge(narrow).valueSize > layoutGauge({ ...narrow, valueChars: 11 }).valueSize);
});
