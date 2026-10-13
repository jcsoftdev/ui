import { afterEach, describe, expect, it, vi } from "vitest";
import { createPointerDrag } from "../src/pointer-drag.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const fire = (el: Element, type: string, x: number, y = 0) =>
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 3,
      pointerType: "touch",
      clientX: x,
      clientY: y,
    }),
  );

describe("createPointerDrag slop", () => {
  it("reports nothing and captures nothing until the pointer travels past the slop", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const capture = vi.spyOn(el, "setPointerCapture").mockImplementation(() => {});
    const onMove = vi.fn();
    const onEnd = vi.fn();
    createPointerDrag(el, { slop: 6, onMove, onEnd });
    fire(el, "pointerdown", 0);
    fire(el, "pointermove", 4);
    fire(el, "pointerup", 4);
    expect(capture).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    fire(el, "pointerdown", 0);
    fire(el, "pointermove", 3);
    fire(el, "pointermove", 9);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0].dx).toBe(9);
    fire(el, "pointerup", 9);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("captures on press without a slop, as before", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const capture = vi.spyOn(el, "setPointerCapture").mockImplementation(() => {});
    createPointerDrag(el, {});
    fire(el, "pointerdown", 0);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
