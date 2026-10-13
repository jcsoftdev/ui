/**
 * Value after `clicked` was pressed. A single-select group stays on the pressed item; with
 * `deselectable` pressing the selected item again clears the selection (empty string).
 */
export function nextSegmentedValue(
  current: string,
  clicked: string,
  deselectable: boolean,
): string {
  return deselectable && current === clicked ? "" : clicked;
}
