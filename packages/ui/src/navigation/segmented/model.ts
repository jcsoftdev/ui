/**
 * Value after `clicked` was pressed. A single-select group stays on the pressed item; with
 * `allowDeselect` pressing the selected item again clears the selection (empty string).
 */
export function nextSegmentedValue(
  current: string,
  clicked: string,
  allowDeselect: boolean,
): string {
  return allowDeselect && current === clicked ? "" : clicked;
}
