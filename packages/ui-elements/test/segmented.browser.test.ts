import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineElement } from "../src/internal/base.ts";
import { defineSegmented, type UiSegmented, UiSegmentedItem } from "../src/segmented/segmented.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineSegmented();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const SEG = (attrs = "") => `<ui-segmented aria-label="View" ${attrs}>
  <ui-segmented-item value="day">Day</ui-segmented-item>
  <ui-segmented-item value="week" disabled>Week</ui-segmented-item>
  <ui-segmented-item value="month">Month</ui-segmented-item></ui-segmented>`;

describe("ui-segmented", () => {
  it("is a radiogroup of radios with one tab stop on the selected item", async () => {
    const host = mount(SEG('value="month"'));
    expect(await ax("radiogroup", "View")).toBeTruthy();
    expect((await ax("radio", "Month"))?.properties.checked).toBe("true");
    expect((await ax("radio", "Day"))?.properties.checked).toBe("false");
    const [day, week, month] = host.querySelectorAll<HTMLElement>("ui-segmented-item");
    expect([day!.tabIndex, week!.tabIndex, month!.tabIndex]).toEqual([-1, -1, 0]);
  });

  it("moves focus with arrows (skipping disabled, wrapping) and selects only on Space/Enter/click", async () => {
    const host = mount(SEG());
    const seg = host.querySelector<UiSegmented>("ui-segmented")!;
    const change = vi.fn();
    seg.addEventListener("change", change);
    const [day, , month] = host.querySelectorAll<HTMLElement>("ui-segmented-item");
    day!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(month);
    expect(seg.value).toBe("");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(day);
    await userEvent.keyboard(" ");
    expect(seg.value).toBe("day");
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { value: "day" } }));
    expect(day!.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(seg.value).toBe("");
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { value: "" } }));
  });

  it("ignores disabled items and a disabled group", () => {
    const host = mount(SEG());
    const seg = host.querySelector<UiSegmented>("ui-segmented")!;
    host.querySelector<HTMLElement>("[value=week]")!.click();
    expect(seg.value).toBe("");
    seg.setAttribute("disabled", "");
    host.querySelector<HTMLElement>("[value=day]")!.click();
    expect(seg.value).toBe("");
    expect(seg.getAttribute("aria-disabled")).toBe("true");
  });

  it("roving=off puts every enabled item in the tab order", () => {
    const host = mount(SEG('roving="off"'));
    const [day, week, month] = host.querySelectorAll<HTMLElement>("ui-segmented-item");
    expect([day!.tabIndex, week!.tabIndex, month!.tabIndex]).toEqual([0, -1, 0]);
  });

  it("wires items that upgrade before the group, and keeps a tab stop when one is removed", async () => {
    defineElement("segmented-item", UiSegmentedItem, { prefix: "zz" });
    const host =
      mount(`<zz-segmented aria-label="V" value="b"><zz-segmented-item value="a">A</zz-segmented-item>
      <zz-segmented-item value="b">B</zz-segmented-item></zz-segmented>`);
    defineSegmented({ prefix: "zz" });
    const [a, b] = host.querySelectorAll<HTMLElement>("zz-segmented-item");
    expect([a!.getAttribute("aria-checked"), b!.getAttribute("aria-checked")]).toEqual([
      "false",
      "true",
    ]);
    expect([a!.tabIndex, b!.tabIndex]).toEqual([-1, 0]);
    b!.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(a!.tabIndex).toBe(0);
  });

  it("keeps the user's tab stop when nothing is selected", async () => {
    const host = mount(SEG());
    const month = host.querySelector<HTMLElement>("[value=month]")!;
    month.focus();
    host.querySelector<UiSegmented>("ui-segmented")!.value = "";
    expect(month.tabIndex).toBe(0);
  });

  it("registers under a custom prefix", () => {
    expect(defineSegmented({ prefix: "acme" })).toBe("acme-segmented");
  });
});
