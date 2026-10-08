/** Returns a stable value for the chart. */
export function useThing(seed = 1): number {
  return seed * 2;
}

export const CHART_LIMIT = 10;
