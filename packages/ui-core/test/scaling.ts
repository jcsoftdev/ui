// Load-independent guard against super-linear work. An absolute millisecond budget fails whenever
// the machine is busy; the growth ratio between a small and a 4x input does not, because both
// measurements slow down together. Best-of-N CPU time discards scheduler spikes.

/** CPU time (user + system) of this process in ms: a descheduled thread stops accruing it. */
const cpuMs = (): number => {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
};

const bestOf = (runs: number, work: () => void): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i += 1) {
    const start = cpuMs();
    work();
    best = Math.min(best, cpuMs() - start);
  }
  return best;
};

export interface ScalingOptions<T> {
  make: (size: number) => T;
  /** The work being timed; setup that is not under test belongs in `make`. */
  run: (input: T) => void;
  small: number;
  growth?: number;
  /** Allowed time growth as a multiple of the size growth. Default 2. */
  slack?: number;
  runs?: number;
}

/** Asserts `run` scales near-linearly: `growth`x the input may cost at most `slack * growth`x the time. */
export function scalingError<T>(
  label: string,
  { make, run, small, growth = 4, slack = 2, runs = 3 }: ScalingOptions<T>,
): string | null {
  const a = make(small);
  const b = make(small * growth);
  run(a); // warm up the JIT so the small sample is not inflated by compilation
  const timeA = Math.max(
    bestOf(runs, () => run(a)),
    0.5, // sub-0.5ms timings are noise
  );
  const timeB = bestOf(runs, () => run(b));
  const allowed = slack * growth;
  const ratio = timeB / timeA;
  return ratio <= allowed
    ? null
    : `${label}: input grew ${growth}x but time grew ${ratio.toFixed(1)}x ` +
        `(${timeA.toFixed(1)}ms -> ${timeB.toFixed(1)}ms), allowed ${allowed}x`;
}
