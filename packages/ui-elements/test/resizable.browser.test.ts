import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  keyboardDelta as reactDelta,
  normalizeSizes as reactNormalize,
  resizePair as reactResize,
} from "../../ui/src/containers/resizable/model.ts";
import * as mine from "../src/internal/e11.ts";
import { defineResizable, type UiResizable } from "../src/resizable/resizable.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineResizable();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const group = (attrs = "", dir = "ltr", panelB = 'min-size="20" max-size="80"') =>
  mount(
    `<div dir="${dir}" style="width:600px;height:200px"><ui-resizable ${attrs}>
      <ui-resizable-panel default-size="40" min-size="10">A</ui-resizable-panel>
      <ui-resizable-handle label="Resize sidebar"></ui-resizable-handle>
      <ui-resizable-panel ${panelB}>B</ui-resizable-panel></ui-resizable></div>`,
  ).querySelector<UiResizable>("ui-resizable")!;

const handleOf = (el: Element) => el.querySelector<HTMLElement>("[role=separator]")!;

describe("resizable model (parity with the React kit)", () => {
  it("normalises, resizes and maps keys value for value", () => {
    const constraints = [
      { min: 10, max: 90 },
      { min: 20, max: 80 },
      { min: 0, max: 100 },
    ];
    for (const defaults of [
      [40, undefined, undefined],
      [undefined, undefined, undefined],
      [10, 10, 10],
      [95, 5, undefined],
    ] as const) {
      const sizes = mine.normalizeSizes([...defaults], constraints);
      expect(sizes).toEqual(reactNormalize([...defaults], constraints));
      for (const delta of [-60, -5, 0, 5, 33, 90])
        for (const index of [0, 1, 2])
          expect(mine.resizePair(sizes, constraints, index, delta)).toEqual(
            reactResize(sizes, constraints, index, delta),
          );
    }
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a"])
      for (const orientation of ["horizontal", "vertical"] as const)
        expect(mine.keyboardDelta(key, orientation, true)).toBe(reactDelta(key, orientation, true));
  });
});

describe("ui-resizable", () => {
  it("exposes a separator with its value range and the panel it controls", async () => {
    const el = group();
    const handle = handleOf(el);
    expect(await ax("separator", "Resize sidebar")).toBeTruthy();
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("40");
    expect(handle.getAttribute("aria-valuemin")).toBe("20");
    expect(handle.getAttribute("aria-valuemax")).toBe("80");
    expect(handle.getAttribute("aria-controls")).toBe(el.querySelector("ui-resizable-panel")!.id);
    expect(el.sizes).toEqual([40, 60]);
  });

  it("resizes with the keyboard inside the min/max of both panels", async () => {
    const el = group();
    const layout = vi.fn();
    el.addEventListener("layout", layout);
    handleOf(el).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(el.sizes).toEqual([45, 55]);
    expect(layout).toHaveBeenCalledWith(expect.objectContaining({ detail: { sizes: [45, 55] } }));
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(el.sizes).toEqual([55, 45]);
    expect(handleOf(el).getAttribute("aria-valuenow")).toBe("55");
    await userEvent.keyboard("{End}");
    expect(el.sizes).toEqual([80, 20]);
    await userEvent.keyboard("{ArrowRight}");
    expect(el.sizes).toEqual([80, 20]);
    await userEvent.keyboard("{Home}");
    expect(el.sizes).toEqual([20, 80]);
    await userEvent.keyboard("{ArrowUp}");
    expect(el.sizes).toEqual([20, 80]);
  });

  it("mirrors the arrows in right-to-left", async () => {
    const el = group("", "rtl");
    handleOf(el).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(el.sizes).toEqual([45, 55]);
    await userEvent.keyboard("{ArrowRight}");
    expect(el.sizes).toEqual([40, 60]);
  });

  it("uses the vertical arrows for a column", async () => {
    const el = group('direction="vertical"');
    expect(handleOf(el).getAttribute("aria-orientation")).toBe("horizontal");
    handleOf(el).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(el.sizes).toEqual([45, 55]);
  });

  it("drags with the pointer", () => {
    const el = group();
    const handle = handleOf(el);
    const rect = handle.getBoundingClientRect();
    const fire = (type: string, x: number) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "mouse",
          button: 0,
          clientX: x,
          clientY: rect.top + 5,
          bubbles: true,
        }),
      );
    fire("pointerdown", rect.left + 4);
    fire("pointermove", rect.left + 4 + 60);
    const [a] = el.sizes;
    // 60px of a (600px - handle) group is about 10%
    expect(a).toBeGreaterThan(48);
    expect(a).toBeLessThan(52);
    expect(handle.hasAttribute("data-dragging")).toBe(true);
    fire("pointerup", rect.left + 64);
    expect(handle.hasAttribute("data-dragging")).toBe(false);
    fire("pointermove", rect.left + 200);
    expect(el.sizes[0]).toBe(a);
  });

  it("drags the other way in right-to-left", () => {
    const el = group("", "rtl");
    const handle = handleOf(el);
    const rect = handle.getBoundingClientRect();
    const fire = (type: string, x: number) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "mouse",
          button: 0,
          clientX: x,
          clientY: 5,
          bubbles: true,
        }),
      );
    fire("pointerdown", rect.left + 4);
    fire("pointermove", rect.left + 4 - 60);
    expect(el.sizes[0]).toBeGreaterThan(48);
    fire("pointerup", rect.left - 56);
  });

  it("collapses and restores a collapsible panel with Enter", async () => {
    const el = mount(
      `<ui-resizable style="width:600px;height:100px"><ui-resizable-panel default-size="30" min-size="15" collapsible>A</ui-resizable-panel><ui-resizable-handle></ui-resizable-handle><ui-resizable-panel>B</ui-resizable-panel></ui-resizable>`,
    ).querySelector<UiResizable>("ui-resizable")!;
    const collapse = vi.fn();
    el.addEventListener("collapse", collapse);
    handleOf(el).focus();
    await userEvent.keyboard("{Enter}");
    expect(el.sizes).toEqual([0, 100]);
    expect(collapse).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { index: 0, collapsed: true } }),
    );
    await userEvent.keyboard("{Enter}");
    expect(el.sizes).toEqual([30, 70]);
  });

  it("clears the collapsed state when the panel grows and reports a 0 minimum", async () => {
    const el = mount(
      `<ui-resizable style="width:600px;height:100px"><ui-resizable-panel default-size="30" min-size="15" collapsible>A</ui-resizable-panel><ui-resizable-handle></ui-resizable-handle><ui-resizable-panel>B</ui-resizable-panel></ui-resizable>`,
    ).querySelector<UiResizable>("ui-resizable")!;
    const panel = el.querySelector("ui-resizable-panel")!;
    expect(handleOf(el).getAttribute("aria-valuemin")).toBe("0");
    handleOf(el).focus();
    await userEvent.keyboard("{Enter}");
    expect(panel.hasAttribute("data-collapsed")).toBe(true);
    await userEvent.keyboard("{ArrowRight}");
    expect(el.sizes[0]).toBeGreaterThan(0);
    expect(panel.hasAttribute("data-collapsed")).toBe(false);
  });

  it("does not collapse into a neighbour that cannot grow that far", async () => {
    const el = mount(
      `<ui-resizable style="width:600px;height:100px"><ui-resizable-panel default-size="30" collapsible>A</ui-resizable-panel><ui-resizable-handle></ui-resizable-handle><ui-resizable-panel max-size="80">B</ui-resizable-panel></ui-resizable>`,
    ).querySelector<UiResizable>("ui-resizable")!;
    const collapse = vi.fn();
    el.addEventListener("collapse", collapse);
    handleOf(el).focus();
    await userEvent.keyboard("{Enter}");
    expect(el.sizes).toEqual([30, 70]);
    expect(collapse).not.toHaveBeenCalled();
  });

  it("restores a collapsed panel inside its neighbour's minimum", async () => {
    const el = mount(
      `<ui-resizable style="width:600px;height:100px"><ui-resizable-panel default-size="30" collapsible>A</ui-resizable-panel><ui-resizable-handle></ui-resizable-handle><ui-resizable-panel min-size="60">B</ui-resizable-panel></ui-resizable>`,
    ).querySelector<UiResizable>("ui-resizable")!;
    handleOf(el).focus();
    await userEvent.keyboard("{Enter}");
    expect(el.sizes).toEqual([0, 100]);
    await userEvent.keyboard("{Enter}");
    expect(el.sizes[1]).toBeGreaterThanOrEqual(60);
  });

  it("keeps sizes assigned before the panels exist", async () => {
    const el = document.createElement("ui-resizable") as UiResizable;
    el.style.cssText = "width:600px;height:100px";
    el.sizes = [25, 75];
    el.innerHTML =
      "<ui-resizable-panel>A</ui-resizable-panel><ui-resizable-handle></ui-resizable-handle><ui-resizable-panel>B</ui-resizable-panel>";
    document.body.append(el);
    expect(el.sizes).toEqual([25, 75]);
  });

  it("registers under a custom prefix", () => {
    expect(defineResizable({ prefix: "acme" })).toBe("acme-resizable");
  });
});
