import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDayChip } from "../src/day-chip/day-chip.ts";
import { defineEventBlock } from "../src/event-block/event-block.ts";
import { defineMonthView } from "../src/month-view/month-view.ts";
import { defineTimelineView } from "../src/timeline-view/timeline-view.ts";
import { defineWeekView } from "../src/week-view/week-view.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineDayChip();
  defineEventBlock();
  defineMonthView();
  defineWeekView();
  defineTimelineView();
});

afterEach(() => {
  document.body.innerHTML = "";
});

type View = HTMLElement & { events: unknown[]; markers: unknown[]; shadedDates: string[] };

const EVENTS = [
  { id: "a", date: "2026-10-13", start: "09:00", end: "10:00", title: "Standup", tone: "success" },
  {
    id: "b",
    date: "2026-10-13",
    start: "09:30",
    end: "11:00",
    title: "Review",
    subtitle: "Room 2",
  },
  { id: "c", date: "2026-10-13", start: "14:00", title: "Call" },
  { id: "d", date: "2026-10-14", start: "00:00", title: "Holiday", allDay: true },
];
const MARKERS = [
  { id: "m", date: "2026-10-13", title: "Invoice", tone: "danger", srLabel: "Deadline" },
];

async function view(tag: string, attrs: string): Promise<View> {
  const host = mount(`<${tag} ${attrs} style="display:block;width:900px"></${tag}>`);
  const element = host.querySelector<View>(tag)!;
  element.events = EVENTS;
  element.markers = MARKERS;
  await wait(20);
  return element;
}

describe("ui-day-chip and ui-event-block", () => {
  it("are native buttons named from their content, with sr-label first", async () => {
    mount(`<ui-day-chip marker-id="m" heading="Invoice" subtitle="due" sr-label="Deadline" tone="danger"></ui-day-chip>
      <ui-event-block event-id="e" heading="Standup" subtitle="Room 2" start="09:00" end="10:00"></ui-event-block>`);
    expect(await ax("button", "Deadline Invoice · due")).toBeTruthy();
    expect(await ax("button", "09:00–10:00 Standup Room 2")).toBeTruthy();
  });

  it("emit open with the id on click and on Enter or Space", async () => {
    const host = mount(
      `<ui-event-block event-id="e" heading="Standup" start="09:00" variant="compact"></ui-event-block>`,
    );
    const opened: string[] = [];
    host.addEventListener("open", (event) => opened.push((event as CustomEvent).detail.id));
    host.querySelector<HTMLElement>("ui-event-block")!.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(opened).toEqual(["e", "e"]);
  });

  it("render the trailing slot only when something is slotted", async () => {
    const host = mount(`<ui-event-block heading="A" start="09:00"></ui-event-block>
      <ui-event-block heading="B" start="09:00"><b slot="trailing">T</b></ui-event-block>`);
    await wait(20);
    const [plain, rich] = [...host.querySelectorAll("ui-event-block")];
    expect(plain!.shadowRoot!.querySelector<HTMLElement>('[data-cal="trailing"]')!.hidden).toBe(
      true,
    );
    expect(rich!.shadowRoot!.querySelector<HTMLElement>('[data-cal="trailing"]')!.hidden).toBe(
      false,
    );
  });
});

describe("ui-month-view", () => {
  it("builds full weeks from the configured week start and locale", async () => {
    const monday = await view(
      "ui-month-view",
      'month="2026-10-13" today="2026-10-13" locale="en-US"',
    );
    const cells = [...monday.querySelectorAll<HTMLElement>('[data-cal="day"]')];
    expect(cells[0]!.dataset.date).toBe("2026-09-28");
    expect(cells.length).toBe(35);
    expect([...monday.querySelectorAll('[data-cal="weekday"]')].map((e) => e.textContent)[0]).toBe(
      "Mon",
    );
    expect(monday.querySelector("[data-today]")!.getAttribute("data-date")).toBe("2026-10-13");

    const sunday = await view("ui-month-view", 'month="2026-10-13" week-starts-on="0" locale="es"');
    expect(sunday.querySelector<HTMLElement>('[data-cal="day"]')!.dataset.date).toBe("2026-09-27");
    expect(sunday.querySelector('[data-cal="weekday"]')!.textContent).toMatch(/^dom/i);

    const auto = await view(
      "ui-month-view",
      'month="2026-10-13" week-starts-on="auto" locale="en-US"',
    );
    expect(auto.querySelector<HTMLElement>('[data-cal="day"]')!.dataset.date).toBe("2026-09-27");
  });

  it("caps a day at three items, offers +n more and emits the open events", async () => {
    const element = await view("ui-month-view", 'month="2026-10-13" more-label="+{count} extra"');
    const day = element.querySelector<HTMLElement>('[data-date="2026-10-13"]')!;
    expect(
      day.querySelectorAll(
        '[data-cal="items"] > [data-cal="chip"], [data-cal="items"] > [data-cal="event"]',
      ).length,
    ).toBe(3);
    const more = day.querySelector<HTMLButtonElement>('[data-cal="more"]')!;
    expect(more.textContent).toBe("+1 extra");
    const seen: string[] = [];
    element.addEventListener("select-date", (e) => seen.push((e as CustomEvent).detail.date));
    element.addEventListener("open-marker", (e) =>
      seen.push(`marker:${(e as CustomEvent).detail.id}`),
    );
    element.addEventListener("open-event", (e) =>
      seen.push(`event:${(e as CustomEvent).detail.id}`),
    );
    more.click();
    day.querySelector<HTMLButtonElement>('[data-cal="chip"]')!.click();
    day.querySelector<HTMLButtonElement>('[data-cal="event"]')!.click();
    expect(seen).toEqual(["2026-10-13", "marker:m", "event:a"]);
  });

  it("swaps the items for dots under 40rem", async () => {
    const element = await view("ui-month-view", 'month="2026-10-13"');
    element.style.width = "360px";
    await wait(30);
    const day = element.querySelector('[data-date="2026-10-13"]')!;
    expect(getComputedStyle(day.querySelector('[data-cal="items"]')!).display).toBe("none");
    expect(day.querySelectorAll('[data-cal="dot"]').length).toBe(4);
    expect(day.querySelector('[data-cal="dot"]')!.getAttribute("aria-label")).toBe("Invoice");
  });

  it("keeps the items in the tab order by default and becomes one roving tab stop with `roving`", async () => {
    const element = await view("ui-month-view", 'month="2026-10-13" roving');
    await wait(50);
    const items = [
      ...element.querySelectorAll<HTMLElement>('[data-ui="month-view"] [data-kind]'),
    ].filter((i) => i.checkVisibility());
    expect(items.filter((i) => i.tabIndex === 0).length).toBe(1);
    items[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[1]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(items.at(-1));
  });
});

describe("ui-week-view", () => {
  it("packs overlapping events side by side and places them on the hour grid", async () => {
    const element = await view(
      "ui-week-view",
      'week="2026-10-13" today="2026-10-13" current-time="09:15" working-hours="9,17"',
    );
    const slot = (id: string) =>
      element.querySelector<HTMLElement>(`[data-cal="slot"][data-event="${id}"]`)!;
    const hour = Number.parseFloat(getComputedStyle(element).getPropertyValue("--agenda-hour"));
    const a = slot("a").getBoundingClientRect();
    const b = slot("b").getBoundingClientRect();
    const column = slot("a").parentElement!.getBoundingClientRect();
    expect(a.width).toBeCloseTo((column.width - 1) / 2, 0);
    expect(b.left - a.left).toBeCloseTo((column.width - 1) / 2, 0);
    expect(a.height).toBeCloseTo(hour - 2, 0);
    expect(b.top - a.top).toBeCloseTo(hour / 2, 0);
    expect(slot("c").querySelector('[data-variant="compact"]')).toBeTruthy();
    expect(slot("a").querySelector('[data-variant="detailed"]')).toBeTruthy();
    expect(element.querySelector("[data-now-line]")).toBeTruthy();
    expect(element.querySelector("[data-working-hours]")).toBeTruthy();
    expect(element.querySelector("[data-all-day-row] [data-event='d']")).toBeTruthy();
    expect(element.querySelector("[data-all-day-row] [data-cal='chip']")).toBeTruthy();
  });

  it("starts scrolled to 08:00 and localizes the day headers", async () => {
    const element = await view("ui-week-view", 'week="2026-10-13" locale="en-US"');
    const hour = Number.parseFloat(getComputedStyle(element).getPropertyValue("--agenda-hour"));
    expect(element.querySelector<HTMLElement>("[data-hours-scroll]")!.scrollTop).toBeCloseTo(
      8 * hour,
      0,
    );
    expect(element.querySelector('[data-cal="day-header"]')!.textContent).toBe("Mon 12");
  });
});

describe("ui-timeline-view", () => {
  it("lists today and each day with items as named groups, sorted, with the empty label", async () => {
    const element = await view(
      "ui-timeline-view",
      'today="2026-10-12" locale="en-US" today-label="today" empty-label="Free"',
    );
    const groups = [...element.querySelectorAll<HTMLElement>('[role="group"]')];
    expect(groups.map((g) => g.dataset.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(groups[0]!.getAttribute("aria-label")).toBe("Mon 12 · today");
    expect(groups[0]!.querySelector('[data-cal="empty"]')!.textContent).toBe("Free");
    expect(await ax("group", "Tue 13")).toBeTruthy();
    const buttons = [...groups[1]!.querySelectorAll("button")].map((b) => b.dataset.id);
    expect(buttons).toEqual(["m", "a", "b", "c"]);
  });

  it("hides listed dates except today", async () => {
    const element = await view(
      "ui-timeline-view",
      'today="2026-10-13" hidden-dates="2026-10-13,2026-10-14"',
    );
    expect(
      [...element.querySelectorAll<HTMLElement>('[role="group"]')].map((g) => g.dataset.date),
    ).toEqual(["2026-10-13"]);
  });
});

describe("registration", () => {
  it("works under a custom prefix", () => {
    expect(defineWeekView({ prefix: "acme" })).toBe("acme-week-view");
    expect(defineDayChip({ prefix: "acme" })).toBe("acme-day-chip");
  });
});
