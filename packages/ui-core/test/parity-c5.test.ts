import { describe, expect, it } from "vitest";
import * as reactStick from "../../ui/src/ai/conversation/stick.ts";
import * as reactNumber from "../../ui/src/atoms/number-value/format.ts";
import * as reactDate from "../../ui/src/calendar/internal/date-utils.ts";
import * as reactLayout from "../../ui/src/calendar/internal/layout.ts";
import * as reactSpy from "../../ui/src/containers/scrolly/scrolly-logic.ts";
import * as reactToc from "../../ui/src/navigation/floating-toc/model.ts";
import { consumeContext, createContextKey, provideContext } from "../src/context.ts";
import * as layout from "../src/date/layout.ts";
import * as date from "../src/date.ts";
import * as number from "../src/number.ts";
import * as scrollSpy from "../src/observe/scroll-spy.ts";
import * as stick from "../src/observe/stick-to-bottom.ts";

const DAYS = ["2024-01-31", "2024-02-29", "2023-02-28", "2024-12-31", "2025-03-09", "2026-10-13"];

describe("date parity with the React calendar", () => {
  it("matches week and month math for every week start", () => {
    for (const day of DAYS)
      for (const start of [0, 1, 2, 3, 4, 5, 6] as const) {
        expect(date.startOfWeek(day, start)).toBe(reactDate.startOfWeek(day, start));
        expect(date.monthGrid(day, start)).toEqual(reactDate.monthGrid(day, start));
      }
    for (const day of DAYS)
      for (const n of [-40, -1, 0, 1, 7, 366])
        expect(date.addDays(day, n)).toBe(reactDate.addDays(day, n));
  });

  it("matches locale formatting", () => {
    for (const locale of [undefined, "en", "es-PE", "ja"]) {
      for (const day of DAYS) {
        expect(date.formatWeekday(day, locale)).toBe(reactDate.formatWeekday(day, locale));
        expect(date.formatWeekdayAndDay(day, locale)).toBe(
          reactDate.formatWeekdayAndDay(day, locale),
        );
        expect(date.formatMonthShort(day, locale)).toBe(reactDate.formatMonthShort(day, locale));
      }
      for (const hour of [0, 9, 13, 23])
        expect(date.formatHour(hour, locale)).toBe(reactDate.formatHour(hour, locale));
    }
  });

  it("golden month grid: Oct 2026 starting Monday", () => {
    const grid = date.monthGrid("2026-10-13", 1);
    expect(grid).toHaveLength(35);
    expect([grid[0], grid.at(-1)]).toEqual(["2026-09-28", "2026-11-01"]);
  });

  it("clamps addMonths to the target month length", () => {
    expect(date.addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(date.addMonths("2023-01-31", 1)).toBe("2023-02-28");
    expect(date.addMonths("2024-03-15", -3)).toBe("2023-12-15");
    expect(date.weekDays("2026-10-13", 1)[0]).toBe("2026-10-12");
  });

  it("packs overlapping events like the React layout", () => {
    const events = [
      { id: "a", start: "09:00", end: "10:30" },
      { id: "b", start: "09:30", end: "10:00" },
      { id: "c", start: "10:00", end: "11:00" },
      { id: "d", start: "12:00" },
      { id: "e", start: "12:15", end: "12:20" },
      { id: "f", start: "09:00", end: "09:00" },
    ];
    const strip = (
      items: {
        event: { id: string };
        start: number;
        end: number;
        column: number;
        columns: number;
      }[],
    ) => items.map(({ event, ...rest }) => ({ id: event.id, ...rest }));
    const ours = strip(layout.layoutDayEvents(events));
    expect(ours).toEqual(strip(reactLayout.layoutDayEvents(events as never) as never));
    expect(ours.find((item) => item.id === "d")).toMatchObject({ column: 0, columns: 2, end: 750 });
  });
});

describe("number parity with the React NumberValue", () => {
  it("matches Intl formatting", () => {
    const configs = [
      undefined,
      { locale: "en", style: "currency", currency: "USD" },
      { style: "currency", currency: "PEN" },
      { locale: "de", style: "percent", maximumFractionDigits: 1 },
      { locale: "en", notation: "compact" },
    ] as const;
    for (const config of configs)
      for (const value of [0, 0.256, 1234.5, -98765.4321, 1e9])
        expect(number.formatNumber(value, config as never)).toBe(
          reactNumber.formatNumber(value, config as never),
        );
  });

  it("matches the easing and the tween, golden at the midpoint", () => {
    for (const t of [-1, 0, 0.1, 0.5, 0.9, 1, 2])
      expect(number.easeOutCubic(t)).toBe(reactNumber.easeOutCubic(t));
    for (const p of [0, 0.25, 0.5, 0.99, 1, 1.5])
      expect(number.tweenValue(10, 110, p)).toBe(reactNumber.tweenValue(10, 110, p));
    expect(number.tweenValue(0, 100, 0.5)).toBe(87.5);
    expect(number.formatNumber(1234.5, { locale: "en" })).toBe("1,234.5");
  });

  it("animateNumber ends exactly on the target and reports once when reduced", () => {
    const seen: number[] = [];
    number.animateNumber({ from: 0, to: 5, reduced: true, onFrame: (v) => seen.push(v) });
    expect(seen).toEqual([5]);
  });
});

describe("observe parity with the React scroll logic", () => {
  it("matches the toc and scrollytelling pickers", () => {
    const order = ["a", "b", "c"];
    for (const visible of [[], ["b"], ["c", "a"]])
      for (const previous of [null, "b", "zzz"])
        expect(scrollSpy.pickActive(order, new Set(visible), previous)).toBe(
          reactToc.pickActive(order, new Set(visible), previous),
        );
    const rects = [
      { top: 0, bottom: 100 },
      { top: 120, bottom: 300 },
      { top: 300, bottom: 400 },
    ];
    for (const line of [-10, 50, 110, 120, 299, 300, 500]) {
      expect(scrollSpy.pickActiveStep(rects, line)).toBe(reactSpy.pickActiveStep(rects, line));
      expect(scrollSpy.stepProgress(rects[1]!, line)).toBe(reactSpy.stepProgress(rects[1]!, line));
    }
    for (const offset of [-1, 0, 0.5, 0.333, 2]) {
      expect(scrollSpy.lineRootMargin(offset)).toBe(reactSpy.lineRootMargin(offset));
      expect(scrollSpy.triggerLine(10, 800, offset)).toBe(reactSpy.triggerLine(10, 800, offset));
    }
  });

  it("matches the stick-to-bottom decisions", () => {
    const metrics = [
      { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 },
      { scrollTop: 560, scrollHeight: 1000, clientHeight: 400 },
      { scrollTop: 600, scrollHeight: 1000, clientHeight: 400 },
      { scrollTop: 700, scrollHeight: 1000, clientHeight: 400 },
    ];
    for (const m of metrics) {
      expect(stick.distanceFromBottom(m)).toBe(reactStick.distanceFromBottom(m));
      for (const stuck of [true, false]) {
        expect(stick.nextStuck(stuck, m, 650)).toBe(reactStick.nextStuck(stuck, m, 650));
        expect(stick.showJumpToLatest(stuck, m)).toBe(reactStick.showJumpToLatest(stuck, m));
      }
    }
    expect(stick.isNearBottom(metrics[1]!)).toBe(true);
    expect(stick.isNearBottom(metrics[0]!)).toBe(false);
  });
});

describe("context", () => {
  it("answers the nearest provider and pushes updates", () => {
    const key = createContextKey<string>("strings");
    const root = new EventTarget();
    const provider = provideContext(root, key, "en");
    const seen: string[] = [];
    // Node's EventTarget has no bubbling; dispatching on the provider itself is enough here.
    const stop = consumeContext(root, key, (v) => seen.push(v));
    provider.set("es");
    provider.set("es");
    stop?.();
    provider.set("fr");
    expect(seen).toEqual(["en", "es"]);
    provider.destroy();
    expect(consumeContext(root, key, () => {})).toBeNull();
  });
});
