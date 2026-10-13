import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineCell, type UiCell } from "../src/cell/cell.ts";
import { defineSwitch } from "../src/switch/switch.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineCell();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const detailOf = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls[0] as [CustomEvent])[0].detail;
const cell = (host: HTMLElement) => host.querySelector<UiCell>("ui-cell")!;

describe("ui-cell", () => {
  it("switch: a native role=switch named by the row title, change carries checked", async () => {
    const host = mount(`<ui-cell variant="switch" heading="Notifications" checked></ui-cell>`);
    const onChange = vi.fn();
    cell(host).addEventListener("change", onChange);
    const node = await ax("switch", "Notifications");
    expect(node).toBeTruthy();
    expect(node?.properties.checked).toBe("true");
    await userEvent.click(host.querySelector("input")!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(detailOf(onChange)).toEqual({ checked: false });
    expect(cell(host).checked).toBe(false);
  });

  it("switch: uses <ui-switch> of the same prefix when it is defined", async () => {
    defineSwitch();
    const host = mount(`<ui-cell variant="switch" heading="Sync" disabled></ui-cell>`);
    const control = host.querySelector("ui-switch")!;
    expect(control).toBeTruthy();
    expect(control.hasAttribute("disabled")).toBe(true);
    expect(await ax("switch", "Sync")).toBeTruthy();
  });

  it("select: options become a labelled native select and change carries the value", async () => {
    const host = mount(`<ui-cell variant="select" heading="Language" value="es">
      <option value="en">English</option><option value="es">Spanish</option></ui-cell>`);
    const select = host.querySelector("select")!;
    expect(select.value).toBe("es");
    expect(await ax("combobox", "Language")).toBeTruthy();
    const onChange = vi.fn();
    cell(host).addEventListener("change", onChange);
    await userEvent.selectOptions(select, "en");
    expect(detailOf(onChange)).toEqual({ value: "en" });
    expect(cell(host).value).toBe("en");
  });

  it("slider: a range named by the title, with the value shown and a numeric change", async () => {
    const host = mount(
      `<ui-cell variant="slider" heading="Volume" min="0" max="10" step="1" value="3"></ui-cell>`,
    );
    const range = host.querySelector<HTMLInputElement>("input[type=range]")!;
    expect(await ax("slider", "Volume")).toBeTruthy();
    const onChange = vi.fn();
    cell(host).addEventListener("change", onChange);
    range.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(range.value).toBe("4");
    expect(host.querySelector("output")?.textContent).toBe("4");
    range.dispatchEvent(new Event("change", { bubbles: true }));
    expect(detailOf(onChange)).toEqual({ value: 4 });
  });

  it("color: a radiogroup of swatches with arrow-key selection", async () => {
    const host = mount(`<ui-cell variant="color" heading="Accent">
      <option value="blue" data-swatch="blue">Blue</option>
      <option value="green" data-swatch="green">Green</option></ui-cell>`);
    expect(await ax("radiogroup", "Accent")).toBeTruthy();
    expect(cell(host).value).toBe("blue");
    const onChange = vi.fn();
    cell(host).addEventListener("change", onChange);
    host.querySelector<HTMLInputElement>("input:checked")!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(detailOf(onChange)).toEqual({ value: "green" });
    expect(cell(host).value).toBe("green");
    cell(host).value = "blue";
    expect(host.querySelector<HTMLInputElement>("input:checked")?.value).toBe("blue");
  });

  it("rebuilds when options arrive after the element upgraded", async () => {
    const host = mount(`<ui-cell variant="select" heading="Late"></ui-cell>`);
    const element = cell(host);
    element.append(Object.assign(document.createElement("option"), { value: "a", text: "A" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(host.querySelectorAll("select option")).toHaveLength(1);
  });
});
