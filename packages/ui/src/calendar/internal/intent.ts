import type { IntentProps } from "../../intent/index.js";
import type { CalendarEvent, CalendarMarker } from "./types.js";

export const calendarItemIntent = (
  item: CalendarEvent | CalendarMarker,
  override: IntentProps = {},
): IntentProps => ({
  intent: override.intent ?? item.intent,
  intentKey: override.intentKey ?? item.intentKey ?? item.id,
});
