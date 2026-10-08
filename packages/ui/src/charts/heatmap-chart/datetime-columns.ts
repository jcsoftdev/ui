import { timeTicks } from "../core/scales/time.js";

const clock = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

/**
 * Column labels for a heatmap whose columns are consecutive points in time.
 * Spans of two days or more are labelled only at calendar boundaries (Mondays,
 * first of the month, January) on the column closest to each boundary, the way
 * a continuous time axis would; shorter spans label every column with its clock
 * time and leave the thinning to the grid. Other columns get `null`.
 */
export function datetimeColumnLabels(
  dates: ReadonlyArray<Date | number>,
  maxLabels = 8,
): Array<string | null> {
  const times = dates.map((date) => +date);
  if (times.length === 0) return [];
  const first = times[0] as number;
  const last = times[times.length - 1] as number;
  const gaps = times.slice(1).map((time, index) => time - (times[index] as number));
  const step = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 1 : 1;
  const ticks = last - first >= 2 * 86_400_000 ? timeTicks(first, last, maxLabels) : [];
  if (ticks.length < 2) return times.map((time) => clock.format(time));
  const labels: Array<string | null> = times.map(() => null);
  for (const tick of ticks) {
    let best = -1;
    let distance = Number.POSITIVE_INFINITY;
    times.forEach((time, index) => {
      const d = Math.abs(time - tick.value);
      if (d < distance) {
        best = index;
        distance = d;
      }
    });
    if (best >= 0 && distance <= step && labels[best] == null) labels[best] = tick.label;
  }
  return labels;
}
