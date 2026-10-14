import assert from "node:assert/strict";
import { test } from "node:test";
import { compare } from "../packages/ui-compose/scripts/check-chart-bench.mjs";

const baseline = { benchmarks: { lttb: { normalized: 0.1 }, stack: { normalized: 0.2 } } };

test("a benchmark within 50% of the baseline passes", () => {
  assert.deepEqual(compare(baseline, { benchmarks: { lttb: { normalized: 0.149 }, stack: { normalized: 0.1 } } }), []);
});

test("a benchmark more than 50% slower fails and a missing one is reported", () => {
  const problems = compare(baseline, { benchmarks: { lttb: { normalized: 0.16 } } });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /lttb: 1\.60x/);
  assert.match(problems[1], /stack: missing/);
});
