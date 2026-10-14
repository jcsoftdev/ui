// The race maths is a port: pin it to the React kit's source, value for value.
import { describe, expect, it } from "vitest";
import * as race from "../src/chart/race.ts";

const react = (await import("../../ui/src/charts/bar-chart/bar-race.ts")) as typeof race;

/** Small deterministic generator, so the cases are the same on every run. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("bar race maths", () => {
  const next = seeded(17);
  const frames = Array.from({ length: 6 }, (_, f) => ({
    label: `f${f}`,
    values: Array.from({ length: 9 }, () => Math.round(next() * 400) / 4),
  }));
  // Ties and zeros exercise the stable tie-break.
  const edge = [
    { label: "a", values: [5, 5, 0, 5] },
    { label: "b", values: [0, 5, 5, 9] },
  ];

  it("ranks like React, ties by entity order", () => {
    for (const f of [...frames, ...edge])
      expect(race.ranksOf(f.values)).toEqual(react.ranksOf(f.values));
    expect(race.ranksOf([3, 3, 1])).toEqual([0, 1, 2]);
  });

  it("interpolates items like React at integer, fractional and out-of-range positions", () => {
    for (const set of [frames, edge])
      for (const position of [-1, 0, 0.25, 0.5, 1, 2.75, 3.01, set.length - 1, set.length + 4]) {
        const ours = race.raceItems(set, position);
        const theirs = react.raceItems(set, position);
        expect(ours).toEqual(theirs);
        for (const limit of [1, 3, 6, 20])
          expect(race.visibleMax(ours, limit)).toBe(react.visibleMax(theirs, limit));
      }
    expect(race.raceItems([], 0.5)).toEqual([]);
  });
});
