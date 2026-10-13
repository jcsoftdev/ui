import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  attachBrush,
  attachIndexBrush,
  type BrushRect,
  type IndexRange,
} from "../src/chart/brush.ts";
import { attachPanZoom, type PanZoomView } from "../src/chart/pan-zoom.ts";

function stage(width = 400, height = 200): HTMLElement {
  const el = document.createElement("div");
  el.tabIndex = 0;
  el.style.cssText = `position:fixed;left:20px;top:20px;width:${width}px;height:${height}px;touch-action:none`;
  document.body.append(el);
  return el;
}

function pointer(
  el: Element,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
): void {
  const box = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: box.left + x,
      clientY: box.top + y,
      ...init,
    }),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("attachPanZoom", () => {
  it("zooms with Ctrl+wheel around the cursor, and lets a plain wheel scroll the page", () => {
    const el = stage();
    const pz = attachPanZoom(el, { minZoom: 0.5, maxZoom: 4 });
    const box = el.getBoundingClientRect();
    const wheel = (init: WheelEventInit) =>
      el.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: box.left + 100,
          clientY: box.top + 50,
          ...init,
        }),
      );
    wheel({ deltaY: -400 });
    expect(pz.view.k).toBe(1);
    wheel({ deltaY: -400, ctrlKey: true });
    const { k, x, y } = pz.view;
    expect(k).toBeCloseTo(Math.exp(1), 6);
    // The content point under the cursor did not move.
    expect((100 - x) / k).toBeCloseTo(100, 6);
    expect((50 - y) / k).toBeCloseTo(50, 6);
    for (let i = 0; i < 10; i++) wheel({ deltaY: -400, ctrlKey: true });
    expect(pz.view.k).toBe(4);
    for (let i = 0; i < 30; i++) wheel({ deltaY: 400, ctrlKey: true });
    expect(pz.view.k).toBe(0.5);
    pz.destroy();
  });

  it("drags past a threshold, treats a short press as a click, and pinches with two pointers", () => {
    const el = stage();
    const interacting: boolean[] = [];
    const pz = attachPanZoom(el, { onInteract: (value) => interacting.push(value) });
    pointer(el, "pointerdown", 50, 50);
    pointer(el, "pointermove", 52, 51);
    pointer(el, "pointerup", 52, 51);
    expect(pz.view).toEqual({ k: 1, x: 0, y: 0 });
    expect(pz.wasDrag()).toBe(false);

    pointer(el, "pointerdown", 50, 50);
    pointer(el, "pointermove", 80, 70);
    pointer(el, "pointermove", 90, 75);
    expect(pz.view).toEqual({ k: 1, x: 40, y: 25 });
    expect(pz.userMoved).toBe(true);
    pointer(el, "pointerup", 90, 75);
    expect(pz.wasDrag()).toBe(true);
    expect(interacting).toEqual([true, false]);

    pz.reset();
    pointer(el, "pointerdown", 100, 100, { pointerId: 1 });
    pointer(el, "pointerdown", 140, 100, { pointerId: 2 });
    pointer(el, "pointermove", 160, 100, { pointerId: 2 });
    expect(pz.view.k).toBeCloseTo(60 / 40, 6);
    pz.destroy();
  });

  it("pans and zooms from the keyboard and resets to home with 0", async () => {
    const el = stage();
    const changes = vi.fn<(view: PanZoomView) => void>();
    const home = { k: 0.5, x: 10, y: 10 };
    const pz = attachPanZoom(el, { home: () => home, initial: home, onChange: changes });
    el.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(pz.view).toEqual({ k: 0.5, x: -38, y: 10 });
    await userEvent.keyboard("{ArrowDown}");
    expect(pz.view.y).toBe(-38);
    await userEvent.keyboard("+");
    expect(pz.view.k).toBeCloseTo(0.625, 6);
    await userEvent.keyboard("0");
    expect(pz.view).toEqual(home);
    expect(pz.userMoved).toBe(false);
    pz.destroy();
    changes.mockClear();
    await userEvent.keyboard("{ArrowLeft}");
    expect(changes).not.toHaveBeenCalled();
  });
});

describe("attachBrush", () => {
  const xDomain = [0, 100] as const;
  const yDomain = [0, 50] as const;

  it("draws a rectangle with a drag, reports the draft, and a click clears it", () => {
    const el = stage(400, 200);
    const onChange = vi.fn<(rect: BrushRect | null) => void>();
    const drafts: Array<BrushRect | null> = [];
    const brush = attachBrush(el, {
      xDomain,
      yDomain,
      onChange,
      onDraft: (rect) => drafts.push(rect),
    });
    pointer(el, "pointerdown", 100, 150);
    pointer(el, "pointermove", 300, 50);
    expect(drafts.at(-1)).toEqual({ x0: 25, x1: 75, y0: 12.5, y1: 37.5 });
    pointer(el, "pointerup", 300, 50);
    expect(onChange).toHaveBeenLastCalledWith({ x0: 25, x1: 75, y0: 12.5, y1: 37.5 });
    expect(drafts.at(-1)).toBeNull();

    // A drag that leaves the plot is clamped to the domain.
    pointer(el, "pointerdown", 300, 100);
    pointer(el, "pointermove", 900, -90);
    pointer(el, "pointerup", 900, -90);
    expect(onChange).toHaveBeenLastCalledWith({ x0: 75, x1: 100, y0: 25, y1: 50 });

    brush.update({ value: { x0: 25, x1: 75, y0: 0, y1: 50 } });
    onChange.mockClear();
    pointer(el, "pointerdown", 200, 100);
    pointer(el, "pointerup", 201, 101);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    brush.destroy();
  });

  it("ignores presses outside the plot box", () => {
    const el = stage(400, 200);
    const onChange = vi.fn();
    attachBrush(el, {
      xDomain,
      yDomain,
      onChange,
      plot: () => ({ x: 40, y: 10, width: 300, height: 150 }),
    });
    pointer(el, "pointerdown", 10, 100);
    pointer(el, "pointermove", 200, 100);
    pointer(el, "pointerup", 200, 100);
    expect(onChange).not.toHaveBeenCalled();
    pointer(el, "pointerdown", 40, 10);
    pointer(el, "pointermove", 340, 160);
    pointer(el, "pointerup", 340, 160);
    expect(onChange).toHaveBeenLastCalledWith({ x0: 0, x1: 100, y0: 0, y1: 50 });
  });

  it("works from the keyboard: arrows draft, Shift resizes, Enter commits, Escape clears", async () => {
    const el = stage();
    const onChange = vi.fn<(rect: BrushRect | null) => void>();
    const drafts: Array<BrushRect | null> = [];
    const brush = attachBrush(el, {
      xDomain,
      yDomain,
      value: null,
      onChange,
      onDraft: (rect) => drafts.push(rect),
    });
    el.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowRight}");
    expect(drafts.at(-1)).toEqual({ x0: 30, x1: 80, y0: 12.5, y1: 37.5 });
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(drafts.at(-1)?.x1).toBe(85);
    expect(brush.draft?.x1).toBe(85);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ x0: 30, x1: 85, y0: 12.5, y1: 37.5 });
    expect(brush.draft).toBeNull();

    brush.update({ value: { x0: 30, x1: 85, y0: 12.5, y1: 37.5 } });
    await userEvent.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith(null);
    brush.destroy();
  });

  it("a touch must be held to brush; a swipe never starts it", async () => {
    const el = stage();
    const onChange = vi.fn<(rect: BrushRect | null) => void>();
    attachBrush(el, { xDomain, yDomain, onChange, touchDelay: 60 });
    const touch = { pointerType: "touch", pointerId: 7 };

    pointer(el, "pointerdown", 100, 100, touch);
    pointer(el, "pointermove", 140, 100, touch);
    await wait(90);
    pointer(el, "pointermove", 300, 100, touch);
    pointer(el, "pointerup", 300, 100, touch);
    expect(onChange).not.toHaveBeenCalled();

    pointer(el, "pointerdown", 100, 100, touch);
    await wait(90);
    pointer(el, "pointermove", 300, 150, touch);
    pointer(el, "pointerup", 300, 150, touch);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0]).toEqual({ x0: 25, x1: 75, y0: 12.5, y1: 25 });
  });
});

describe("attachIndexBrush", () => {
  const count = 21;
  const track = 400;
  const step = track / (count - 1);
  const mount = (range: IndexRange) => {
    const el = stage(track + 40, 50);
    el.setAttribute("role", "slider");
    const onChange = vi.fn<(range: IndexRange) => void>();
    const brush = attachIndexBrush(el, {
      count,
      range,
      onChange,
      offset: 20,
      indexAt: (px) => Math.min(count - 1, Math.max(0, Math.round(px / step))),
      position: (index) => index * step,
    });
    return { el, onChange, brush };
  };

  it("drags the window, a handle, or draws a new one", () => {
    const { el, onChange, brush } = mount([5, 10]);
    const at = (index: number) => 20 + index * step;
    pointer(el, "pointerdown", at(7), 20);
    pointer(el, "pointermove", at(10), 20);
    expect(onChange).toHaveBeenLastCalledWith([8, 13]);
    pointer(el, "pointerup", at(10), 20);

    brush.update({ range: [5, 10] });
    pointer(el, "pointerdown", at(10), 20);
    pointer(el, "pointermove", at(16), 20);
    expect(onChange).toHaveBeenLastCalledWith([5, 16]);
    pointer(el, "pointerup", at(16), 20);

    brush.update({ range: [5, 10] });
    pointer(el, "pointerdown", at(18), 20);
    pointer(el, "pointermove", at(14), 20);
    expect(onChange).toHaveBeenLastCalledWith([14, 18]);
    pointer(el, "pointerup", at(14), 20);
    brush.destroy();
  });

  it("pans, resizes and jumps with the keyboard, using the latest window on key repeat", async () => {
    const { el, onChange } = mount([5, 10]);
    el.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith([7, 12]);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onChange).toHaveBeenLastCalledWith([7, 11]);
    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith([16, 20]);
    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith([0, 4]);
  });
});
