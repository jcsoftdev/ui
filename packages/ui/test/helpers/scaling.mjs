// Load-independent guard against super-linear work. Absolute millisecond budgets flake under CPU
// contention; the growth ratio between a small and a 4x input does not, because both measurements
// slow down together. Best-of-N CPU time further discards scheduler spikes.
import assert from "node:assert/strict";

// CPU time (user + system) of this process, not wall time: a descheduled thread stops accruing it,
// so contention from other processes barely moves the measurement.
const cpuMs = () => {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
};

const bestOf = (runs, work) => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i += 1) {
    const start = cpuMs();
    work();
    best = Math.min(best, cpuMs() - start);
  }
  return best;
};

/**
 * Asserts `run(make(n))` scales near-linearly with the input `size` of `make(n)` (its length,
 * unless `sizeOf` says otherwise): growing the input by `growth` may grow the best time by at most
 * `slack` times that factor. Quadratic work lands at roughly `growth` times that factor. Pass
 * `degree: 2` for code that is quadratic by design (memoised, bounded) and must only avoid
 * exponential blow-up.
 */
export function assertScalesLinearly(
  label,
  { make, run, small, growth = 4, slack = 2, degree = 1, runs = 5, sizeOf = (input) => input.length },
) {
  const a = make(small);
  const b = make(small * growth);
  run(a); // warm up the JIT so the small sample is not inflated by compilation
  const timeA = Math.max(bestOf(runs, () => run(a)), 0.5); // floor: sub-0.5ms timings are noise
  const timeB = bestOf(runs, () => run(b));
  const sizeRatio = sizeOf(b) / sizeOf(a);
  const allowed = slack * sizeRatio ** degree;
  const ratio = timeB / timeA;
  assert.ok(
    ratio <= allowed,
    `${label}: input grew ${sizeRatio.toFixed(1)}x but time grew ${ratio.toFixed(1)}x ` +
      `(${timeA.toFixed(1)}ms -> ${timeB.toFixed(1)}ms), allowed ${allowed.toFixed(1)}x`,
  );
  return ratio / allowed;
}
