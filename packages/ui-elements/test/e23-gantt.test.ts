// Golden parity: the Gantt geometry in `src/internal/e23-gantt.ts` is a port of the React
// `charts/core/gantt.ts`. The React module is imported by path at runtime, never statically.
import { describe, expect, it } from "vitest";
import * as mine from "../src/internal/e23-gantt.ts";

const react = (await import("../../ui/src/charts/core/gantt.ts")) as typeof mine;

const day = (month: number, date: number, hour = 0) => +new Date(2026, month, date, hour);
const TASKS = [
  { id: "p", start: day(9, 5), end: day(10, 20) },
  { id: "a", parentId: "p", start: day(9, 5), end: day(9, 12), progress: 1 },
  {
    id: "b",
    parentId: "p",
    start: day(9, 12),
    end: day(9, 26),
    progress: 0.25,
    dependencies: ["a"],
  },
  {
    id: "c",
    parentId: "p",
    start: day(9, 14),
    end: day(10, 20),
    progress: 0.5,
    dependencies: ["a"],
  },
  { id: "d", start: day(10, 20), end: day(10, 28), dependencies: ["b", "c"] },
  { id: "x", start: day(10, 1), end: day(10, 3), dependencies: ["y"] },
  { id: "y", start: day(10, 1), end: day(10, 3), dependencies: ["x"] },
];

describe("gantt geometry matches the React chart", () => {
  const zooms = mine.GANTT_ZOOM_ORDER;

  it("keeps the zoom table", () => {
    expect(mine.GANTT_ZOOMS).toEqual(react.GANTT_ZOOMS);
    expect(mine.GANTT_ZOOM_ORDER).toEqual(react.GANTT_ZOOM_ORDER);
  });

  it("pads the domain, scales it and snaps times the same way for every zoom", () => {
    for (const zoom of zooms) {
      const times = [day(9, 7, 13), day(10, 18, 5)];
      const domain = mine.ganttDomain(times, zoom);
      expect(domain).toEqual(react.ganttDomain(times, zoom));
      const a = mine.ganttScale(domain, zoom, 700);
      const b = react.ganttScale(domain, zoom, 700);
      expect([a.k, a.width, a.x(day(9, 20)), a.invert(123)]).toEqual([
        b.k,
        b.width,
        b.x(day(9, 20)),
        b.invert(123),
      ]);
      for (const step of [mine.HOUR_MS, mine.DAY_MS])
        expect(mine.snapTime(day(9, 8, 17), step)).toBe(react.snapTime(day(9, 8, 17), step));
    }
  });

  it("builds the same two-tier header (labels agree under es-PE and the same quarter text)", () => {
    for (const zoom of zooms) {
      const domain = mine.ganttDomain([day(9, 5), day(11, 20)], zoom);
      const scale = mine.ganttScale(domain, zoom, 900);
      const ours = mine.ganttHeader(scale, zoom, { locale: "es-PE", quarter: (q) => `T${q}` });
      const theirs = react.ganttHeader(scale, zoom, { quarter: (q) => `T${q}` });
      expect(ours).toEqual(theirs);
    }
  });

  it("finds the same non-working spans", () => {
    const domain: [number, number] = [day(9, 1), day(10, 15)];
    expect(mine.nonWorkingSpans(domain, [1, 2, 3, 4, 5], [day(9, 12)])).toEqual(
      react.nonWorkingSpans(domain, [1, 2, 3, 4, 5], [day(9, 12)]),
    );
  });

  it("flattens the task tree and rolls up parents the same way", () => {
    expect(mine.ganttRows(TASKS)).toEqual(react.ganttRows(TASKS));
    expect(mine.ganttRows(TASKS, new Set(["p"]))).toEqual(react.ganttRows(TASKS, new Set(["p"])));
  });

  it("computes the same critical path, slack and tight links", () => {
    expect(mine.criticalPath(TASKS)).toEqual(react.criticalPath(TASKS));
  });

  it("routes and rounds dependency links the same way", () => {
    const cases: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [
        { x: 100, y: 18 },
        { x: 300, y: 54 },
      ],
      [
        { x: 300, y: 18 },
        { x: 120, y: 90 },
      ],
      [
        { x: 100, y: 54 },
        { x: 100, y: 54 },
      ],
      [
        { x: 300, y: 90 },
        { x: 320, y: 18 },
      ],
    ];
    for (const [from, to] of cases) {
      const route = mine.routeDependency(from, to, { rowHeight: 36 });
      expect(route).toEqual(react.routeDependency(from, to, { rowHeight: 36 }));
      expect(mine.roundedPolyline(route)).toBe(react.roundedPolyline(route));
    }
  });
});
