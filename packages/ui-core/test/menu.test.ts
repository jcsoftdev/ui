import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/primitives/menu/grace.ts";
import * as reactNav from "../../ui/src/primitives/menu/navigation.ts";
import {
  checkedStateOf,
  graceArea,
  isPointInPolygon,
  moveIndex,
  toggleChecked,
} from "../src/menu.ts";

describe("menu pure logic", () => {
  it("moves with wrap, clamp and the menu-itself entry points", () => {
    expect(moveIndex(3, 2, "next")).toBe(0);
    expect(moveIndex(3, 0, "prev")).toBe(2);
    expect(moveIndex(3, 2, "next", false)).toBe(2);
    expect(moveIndex(3, -1, "next")).toBe(0);
    expect(moveIndex(3, -1, "prev")).toBe(2);
    expect(moveIndex(0, -1, "next")).toBe(-1);
  });

  it("matches the React kit's navigation and grace maths", () => {
    for (const move of ["next", "prev", "first", "last"] as const)
      for (let count = 0; count < 5; count++)
        for (let current = -1; current < count; current++)
          for (const loop of [true, false])
            expect(moveIndex(count, current, move, loop)).toBe(
              reactNav.moveIndex(count, current, move, loop),
            );
    const box = { left: 200, right: 320, top: 40, bottom: 260 };
    for (const side of ["left", "right"] as const) {
      const area = graceArea({ x: 180, y: 90 }, side, box);
      expect(area).toEqual(react.graceArea({ x: 180, y: 90 }, side, box));
      for (const point of [
        { x: 210, y: 100 },
        { x: 400, y: 100 },
        { x: 100, y: 300 },
      ])
        expect(isPointInPolygon(point, area)).toBe(react.isPointInPolygon(point, area));
    }
  });

  it("detects a pointer inside the grace triangle", () => {
    const area = graceArea({ x: 180, y: 90 }, "right", {
      left: 200,
      right: 320,
      top: 40,
      bottom: 260,
    });
    expect(isPointInPolygon({ x: 215, y: 120 }, area)).toBe(true);
    expect(isPointInPolygon({ x: 150, y: 400 }, area)).toBe(false);
  });

  it("toggles checkbox states", () => {
    expect(toggleChecked(false)).toBe(true);
    expect(toggleChecked(true)).toBe(false);
    expect(toggleChecked("indeterminate")).toBe(true);
    expect(checkedStateOf("indeterminate")).toBe("indeterminate");
  });
});
