// Regression gate for the chart-core micro-benchmarks. Compares build/chart-bench.json (written by `./gradlew :chart-core:chartBench`)
// with the committed charts/chart-core/bench-baseline.json and fails when any benchmark is more than 20% slower.
//   node scripts/check-chart-bench.mjs            check
//   node scripts/check-chart-bench.mjs --update   rewrite the baseline from the last run (only in a commit that says why)
// Each figure is median time divided by a calibration loop timed in the same JVM, so it compares across machines.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resultFile = join(root, "charts/chart-core/build/chart-bench.json");
const baselineFile = join(root, "charts/chart-core/bench-baseline.json");
export const TOLERANCE = 1.2;

export function compare(baseline, result, tolerance = TOLERANCE) {
  const problems = [];
  for (const [name, base] of Object.entries(baseline.benchmarks)) {
    const now = result.benchmarks[name];
    if (!now) problems.push(`${name}: missing from the run`);
    else if (now.normalized > base.normalized * tolerance) {
      problems.push(`${name}: ${(now.normalized / base.normalized).toFixed(2)}x the baseline (limit ${tolerance}x)`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = JSON.parse(readFileSync(resultFile, "utf8"));
  if (process.argv.includes("--update")) {
    const benchmarks = Object.fromEntries(Object.entries(result.benchmarks).map(([k, v]) => [k, { normalized: Number(v.normalized.toPrecision(4)) }]));
    writeFileSync(baselineFile, `${JSON.stringify({ "//": "Lower-quartile time / calibration loop. Raise only in a commit that says why.", benchmarks }, null, 2)}\n`);
    console.log("baseline written");
  } else {
    const problems = compare(JSON.parse(readFileSync(baselineFile, "utf8")), result);
    if (problems.length) {
      console.error(`chart-core benchmarks regressed:\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log(`chart-core benchmarks within ${Math.round((TOLERANCE - 1) * 100)}% of the baseline`);
  }
}
