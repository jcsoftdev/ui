import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { nextGridCell, monthHtml, weekHtml, monthFromServerContext, crowdedMonthHtml } =
  await loadCases("calendar-grid-cases.tsx");

const count = (html, pattern) => (html.match(pattern) ?? []).length;
const size = { rows: 3, cols: 4 };

test("nextGridCell moves inside the grid and stops at the edges", () => {
  const table = [
    [{ row: 1, col: 1 }, "ArrowRight", { row: 1, col: 2 }],
    [{ row: 1, col: 1 }, "ArrowLeft", { row: 1, col: 0 }],
    [{ row: 1, col: 1 }, "ArrowDown", { row: 2, col: 1 }],
    [{ row: 1, col: 1 }, "ArrowUp", { row: 0, col: 1 }],
    [{ row: 1, col: 1 }, "Home", { row: 1, col: 0 }],
    [{ row: 1, col: 1 }, "End", { row: 1, col: 3 }],
    [{ row: 1, col: 3 }, "ArrowRight", undefined],
    [{ row: 1, col: 0 }, "ArrowLeft", undefined],
    [{ row: 0, col: 1 }, "ArrowUp", undefined],
    [{ row: 2, col: 1 }, "ArrowDown", undefined],
    [{ row: 2, col: 3 }, "End", { row: 2, col: 3 }],
  ];
  for (const [at, key, expected] of table) {
    assert.deepEqual(nextGridCell(at, key, size), expected, `${key} from ${JSON.stringify(at)}`);
  }
});

test("month view is a named grid of rows and gridcells", () => {
  const html = monthHtml();
  assert.equal(count(html, /role="grid"/g), 1);
  assert.match(html, /role="grid" aria-label="November 2026"/);
  const rows = html.split('role="row"').slice(1);
  assert.ok(rows.length === 6 || rows.length === 7);
  const [header, ...weeks] = rows;
  assert.equal(count(header, /role="columnheader"/g), 7);
  assert.equal(weeks.length === 5 || weeks.length === 6, true);
  for (const week of weeks) assert.equal(count(week, /role="gridcell"/g), 7);
  assert.match(monthHtml({ "aria-label": "Bookings" }), /aria-label="Bookings"/);
});

test("today is marked current and named by its full date", () => {
  const html = monthHtml();
  assert.equal(count(html, /aria-current="date"/g), 1);
  assert.match(html, /aria-current="date"[^>]*data-date="2026-11-12"/);
  assert.match(html, /<span class="sr-only">Thursday, November 12, 2026<\/span>/);
  assert.match(html, /aria-hidden="true"[^>]*>12<\/span>/);
});

test("exactly one gridcell is tabbable", () => {
  for (const html of [monthHtml(), monthHtml({ today: "2030-01-01" }), weekHtml()]) {
    assert.equal(
      count(html, /role="gridcell"[^>]*tabindex="0"|tabindex="0"[^>]*role="gridcell"/g),
      1,
    );
  }
  assert.match(monthHtml({ today: "2030-01-01" }), /tabindex="0"[^>]*data-date="2026-11-01"/);
});

test("day intent keys are ISO dates", () => {
  const html = monthHtml({ dayIntent: "calendar-day" });
  assert.match(html, /data-intent="calendar-day" data-intent-key="2026-11-12"/);
  assert.equal(count(html, /data-intent="calendar-day"/g), 42);
  assert.doesNotMatch(monthHtml(), /data-intent="calendar-day"/);
  assert.match(
    weekHtml({ dayIntent: "calendar-day" }),
    /data-intent="calendar-day" data-intent-key="2026-11-12"/,
  );
});

test("event intent falls back to the event id", () => {
  const html = monthHtml();
  assert.match(html, /data-intent="booking" data-intent-key="b-2"/);
  assert.match(html, /data-intent="holiday" data-intent-key="m1"/);
  assert.doesNotMatch(html, /data-intent-key="e1"/);
  const withId = monthHtml({
    events: [{ id: "e9", date: "2026-11-12", start: "10:00", title: "X", intent: "booking" }],
  });
  assert.match(withId, /data-intent="booking" data-intent-key="e9"/);
});

test("week view is a named grid with header, all-day and timed rows", () => {
  const html = weekHtml();
  assert.match(
    html,
    /role="grid" aria-label="Monday, November 9, 2026 – Sunday, November 15, 2026"/,
  );
  const rows = html.split('role="row"').slice(1);
  assert.equal(rows.length, 3);
  assert.equal(count(rows[0], /role="columnheader"/g), 7);
  assert.match(rows[1], /aria-label="All day"/);
  assert.equal(count(rows[1], /role="gridcell"/g), 7);
  assert.equal(count(rows[2], /role="gridcell"/g), 7);
  assert.match(html, /aria-hidden="true" class="[^"]*sticky left-0/);
});

test("MonthView stays a server component: formatMore is applied on the server and never crosses the client boundary", () => {
  const read = (name) =>
    readFileSync(new URL(`../src/calendar/month-view/${name}`, import.meta.url), "utf8");
  assert.doesNotMatch(read("month-view.tsx"), /^\s*["']use client["']/);
  assert.match(read("month-grid.tsx"), /^\s*["']use client["']/);
  const element = monthFromServerContext();
  assert.equal(typeof element.type, "function");
  const functionProps = Object.entries(element.props)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name);
  assert.deepEqual(functionProps, []);
  assert.equal(element.props.formatMore, undefined);
  assert.equal(element.props.labels.more["2026-11-12"], "+2 more");
});

test("MonthView renders the server-computed overflow label, weekdays and title", () => {
  const html = crowdedMonthHtml();
  assert.match(html, />\+2 more<\/button>/);
  assert.match(html, /aria-label="November 2026"/);
  assert.match(html, />Mon<\/div>/);
});
