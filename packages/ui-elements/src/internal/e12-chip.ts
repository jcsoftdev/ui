import { button, type CalendarMarker, node, srLabel } from "./e12-cal.js";

/** The compact chip button of a marker (React `DayChip`). */
export function markerButton(marker: CalendarMarker): HTMLButtonElement {
  const chip = button("chip", "marker", marker.id);
  chip.dataset.tone = marker.tone ?? "accent";
  chip.append(srLabel(marker.srLabel) ?? "", marker.title);
  if (marker.subtitle) chip.append(node("span", "subtitle", ` · ${marker.subtitle}`));
  return chip;
}
