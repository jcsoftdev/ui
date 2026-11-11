import { renderToStaticMarkup } from "react-dom/server";
import { MonthView } from "../../src/calendar/month-view/month-view.js";
import { WeekView } from "../../src/calendar/week-view/week-view.js";

export { nextGridCell } from "../../src/calendar/internal/grid-navigation.js";

const events = [
  { id: "e1", date: "2026-11-12", start: "10:00", title: "Haircut" },
  { id: "e2", date: "2026-11-12", start: "11:00", title: "Beard", intent: "booking", intentKey: "b-2" },
  { id: "e3", date: "2026-11-13", start: "09:00", title: "Retreat", allDay: true },
];
const markers = [{ id: "m1", date: "2026-11-12", title: "Holiday", intent: "holiday" }];

export const monthHtml = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <MonthView
      month="2026-11-12"
      today="2026-11-12"
      events={events}
      markers={markers}
      locale="en"
      formatMore={(count) => `+${count}`}
      {...props}
    />,
  );

export const weekHtml = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <WeekView
      week="2026-11-12"
      today="2026-11-12"
      events={events}
      markers={markers}
      locale="en"
      allDayLabel="All day"
      {...props}
    />,
  );
