import { describe, expect, it, vi } from "vitest";
import * as reactGeometry from "../../ui/src/primitives/popper/geometry.ts";
import { resolveTabWrap } from "../src/focus.ts";
import { computePlacement, type PlacementInput, type Side } from "../src/popper.ts";
import { findRovingTarget, getRovingIntent } from "../src/roving.ts";
import { createControllable } from "../src/state.ts";
import { createTypeahead, nextTypeaheadIndex } from "../src/typeahead.ts";

describe("popper geometry", () => {
  const base: PlacementInput = {
    anchor: { x: 100, y: 100, width: 40, height: 20 },
    content: { width: 120, height: 60 },
    boundary: { x: 0, y: 0, width: 800, height: 600 },
  };

  it("places below, centred, by default", () => {
    const p = computePlacement(base);
    expect(p).toMatchObject({ x: 60, y: 120, side: "bottom", align: "center" });
  });

  it("flips to the opposite side when the preferred one overflows", () => {
    const p = computePlacement({ ...base, anchor: { ...base.anchor, y: 560 } });
    expect(p.side).toBe("top");
    expect(p.y).toBe(500);
  });

  it("shifts along the edge to stay inside the boundary", () => {
    const p = computePlacement({ ...base, anchor: { ...base.anchor, x: 0 }, collisionPadding: 8 });
    expect(p.x).toBe(8);
  });

  it("points the arrow at the anchor centre and hides it when it cannot", () => {
    const p = computePlacement({ ...base, arrow: { width: 10, height: 5 } });
    expect(p.y).toBe(125);
    expect(p.arrow).toMatchObject({ x: 55, shouldHide: false });
    const tiny = computePlacement({
      ...base,
      content: { width: 8, height: 60 },
      arrow: { width: 10, height: 5 },
    });
    expect(tiny.arrow?.shouldHide).toBe(true);
  });

  it("matches the React kit's maths for random inputs", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const sides: Side[] = ["top", "right", "bottom", "left"];
    const aligns = ["start", "center", "end"] as const;
    for (let i = 0; i < 500; i++) {
      const input: PlacementInput = {
        anchor: {
          x: rand() * 900 - 50,
          y: rand() * 700 - 50,
          width: rand() * 80,
          height: rand() * 40,
        },
        content: { width: rand() * 300, height: rand() * 300 },
        boundary: { x: 0, y: 0, width: 800, height: 600 },
        side: sides[Math.floor(rand() * 4)],
        align: aligns[Math.floor(rand() * 3)],
        sideOffset: rand() * 10,
        alignOffset: rand() * 10,
        collisionPadding: rand() * 12,
        sticky: rand() > 0.5 ? "partial" : "always",
        dir: rand() > 0.5 ? "ltr" : "rtl",
        ...(rand() > 0.5 ? { arrow: { width: 10, height: 5, padding: 4 } } : {}),
      };
      expect(computePlacement(input)).toEqual(reactGeometry.computePlacement(input));
    }
  });
});

describe("roving focus", () => {
  it("maps keys to intents per orientation and direction", () => {
    expect(getRovingIntent("ArrowRight")).toBe("next");
    expect(getRovingIntent("ArrowRight", { dir: "rtl" })).toBe("prev");
    expect(getRovingIntent("ArrowDown", { orientation: "horizontal" })).toBeUndefined();
    expect(getRovingIntent("ArrowUp", { orientation: "vertical" })).toBe("prev");
    expect(getRovingIntent("Home")).toBe("first");
    expect(getRovingIntent("End")).toBe("last");
    expect(getRovingIntent("a")).toBeUndefined();
  });

  it("wraps only when looping", () => {
    const items = ["a", "b", "c"];
    expect(findRovingTarget(items, "c", "next", true)).toBe("a");
    expect(findRovingTarget(items, "c", "next", false)).toBeUndefined();
    expect(findRovingTarget(items, "a", "prev", true)).toBe("c");
    expect(findRovingTarget(items, "b", "last", false)).toBe("c");
  });
});

describe("focus trap wrap", () => {
  it("wraps at the ends and enters from outside", () => {
    const items = ["a", "b", "c"];
    expect(resolveTabWrap(items, "c", false)).toBe("a");
    expect(resolveTabWrap(items, "a", true)).toBe("c");
    expect(resolveTabWrap(items, "b", false)).toBeNull();
    expect(resolveTabWrap(items, null, true)).toBe("c");
    expect(resolveTabWrap([], "a", false)).toBeNull();
  });
});

describe("typeahead", () => {
  const values = ["Apple", "Avocado", "Banana", "Blueberry", "Cherry"];
  it("cycles a repeated letter and keeps a matching longer search", () => {
    expect(nextTypeaheadIndex(values, "a", 0)).toBe(1);
    expect(nextTypeaheadIndex(values, "bb", 2)).toBe(3);
    expect(nextTypeaheadIndex(values, "blu", 3)).toBe(3);
    expect(nextTypeaheadIndex(values, "z", 0)).toBe(-1);
  });

  it("accumulates keys and clears after the timeout", () => {
    vi.useFakeTimers();
    const typeahead = createTypeahead({ timeout: 500 });
    expect(typeahead.key("b")).toBe("b");
    expect(typeahead.key("l")).toBe("bl");
    expect(typeahead.key("Enter")).toBeUndefined();
    vi.advanceTimersByTime(600);
    expect(typeahead.key("c")).toBe("c");
    vi.useRealTimers();
  });
});

describe("controllable state", () => {
  it("updates when uncontrolled and only notifies when controlled", () => {
    const changes: number[] = [];
    const state = createControllable({ defaultValue: 1, onChange: (v) => changes.push(v) });
    state.set(2);
    state.set(2);
    state.set((v) => v + 1);
    expect(state.get()).toBe(3);
    state.control(10);
    state.set(11);
    expect(state.get()).toBe(10);
    expect(state.controlled).toBe(true);
    state.control(undefined);
    expect(state.get()).toBe(3);
    expect(changes).toEqual([2, 3, 11]);
  });
});
