// Shared by chart/hierarchy and chart/treemap, so neither entry pulls the other in.

/** The value when it is a finite number above zero, otherwise 0. */
export function positive(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
