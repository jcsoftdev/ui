import { describe, expect, it, vi } from "vitest";
import * as reactGrace from "../../ui/src/primitives/menu/grace.ts";
import {
  createGraceTracker,
  createHoverIntent,
  createSkipWindow,
  graceArea,
  isPointInPolygon,
} from "../src/hover-intent.ts";

describe("grace area (parity with the React menu)", () => {
  const box = { left: 200, right: 400, top: 50, bottom: 250 };
  const exits = [
    { x: 190, y: 100 },
    { x: 150, y: 60 },
    { x: 210, y: 240 },
  ];
  it.each(["left", "right"] as const)("builds the same polygon on the %s side", (side) => {
    for (const exit of exits)
      expect(graceArea(exit, side, box)).toEqual(reactGrace.graceArea(exit, side, box));
  });
  it("tests points like the React kit", () => {
    const area = graceArea({ x: 190, y: 100 }, "right", box);
    for (const point of [
      { x: 250, y: 120 },
      { x: 195, y: 100 },
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ])
      expect(isPointInPolygon(point, area)).toBe(reactGrace.isPointInPolygon(point, area));
  });
  it("needs travel toward the submenu and expires", () => {
    vi.useFakeTimers();
    const grace = createGraceTracker(300);
    grace.track(10);
    grace.start({ x: 190, y: 100 }, "right", box);
    expect(grace.isMovingToward({ x: 250, y: 120 })).toBe(true);
    grace.track(5);
    expect(grace.isMovingToward({ x: 250, y: 120 })).toBe(false);
    grace.track(50);
    vi.advanceTimersByTime(301);
    expect(grace.isMovingToward({ x: 250, y: 120 })).toBe(false);
    vi.useRealTimers();
  });
});

describe("createHoverIntent", () => {
  it("opens after the delay, closes after the grace, ignores touch and skips after a close", () => {
    vi.useFakeTimers();
    const states: boolean[] = [];
    const skip = createSkipWindow(300);
    const intent = createHoverIntent({
      onChange: (open) => {
        states.push(open);
        intent.settled(open);
      },
      openDelay: 500,
      closeDelay: 100,
      skip,
    });
    intent.enter({ pointerType: "touch" });
    vi.advanceTimersByTime(1000);
    expect(states).toEqual([]);
    intent.enter();
    vi.advanceTimersByTime(499);
    expect(states).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(states).toEqual([true]);
    intent.leave();
    intent.hold();
    vi.advanceTimersByTime(500);
    expect(states).toEqual([true]);
    intent.leave();
    vi.advanceTimersByTime(100);
    expect(states).toEqual([true, false]);
    intent.enter();
    expect(states).toEqual([true, false, true]);
    intent.close();
    vi.advanceTimersByTime(400);
    intent.enter();
    vi.advanceTimersByTime(499);
    expect(states.at(-1)).toBe(false);
    vi.useRealTimers();
  });
});
