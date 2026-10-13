import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { generateMark, generateVariations } from "../src/internal/e15-brand.ts";
import { defineLogoForge, type UiLogoForge } from "../src/logo-forge/logo-forge.ts";
import { clearStrings, loadStrings } from "../src/strings/strings.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineLogoForge();
});

afterEach(() => {
  document.body.innerHTML = "";
  clearStrings();
});

const make = (attrs = "") =>
  mount(`<ui-logo-forge ${attrs}></ui-logo-forge>`).querySelector("ui-logo-forge") as UiLogoForge;
const press = (forge: UiLogoForge, selector: string) =>
  forge.querySelector<HTMLButtonElement>(selector)!.click();

describe("ui-logo-forge", () => {
  it("is a named region whose choices expose their pressed state", async () => {
    const forge = make();
    expect(await ax("region", "Logo generator")).toBeTruthy();
    expect(
      forge
        .querySelector('[data-field="shape"][data-value="shield"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(forge.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");
  });

  it("edits the value, emits change with generator options and redraws the preview", () => {
    const forge = make();
    const change = vi.fn();
    forge.addEventListener("change", (event) => change((event as CustomEvent).detail));
    press(forge, '[data-field="shape"][data-value="hexagon"]');
    press(forge, '[data-field="layout"][data-value="icon"]');
    expect(forge.value.shape).toBe("hexagon");
    expect(change).toHaveBeenCalledTimes(2);
    expect(change.mock.lastCall?.[0].options.shape).toBe("hexagon");
    const svg = forge.querySelector('[data-ui-part="preview"] svg');
    expect(svg?.getAttribute("viewBox")).toBe(generateMark(forge.options).viewBox);
    expect(svg?.getAttribute("viewBox")).toBe(forge.mark?.viewBox);
  });

  it("shows only the controls that apply (letters vs symbol, custom colours)", () => {
    const forge = make();
    const hidden = (name: string) =>
      forge.querySelector<HTMLElement>(`[data-group="${name}"]`)?.hidden;
    expect([hidden("glyph"), hidden("initialsCount"), hidden("custom")]).toEqual([
      false,
      true,
      true,
    ]);
    press(forge, '[data-field="monogram"][data-value="initials"]');
    press(forge, '[data-field="paletteId"][data-value="custom"]');
    expect([hidden("glyph"), hidden("initialsCount"), hidden("custom")]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("picks a variation exactly as the React kit does, and shuffle pages to the next set", () => {
    const forge = make();
    const first = generateVariations(forge.options, 12, 0)[4]!;
    press(forge, '[data-ui-part="variation"][data-index="4"]');
    expect(forge.value.seed).toBe(first.seed);
    expect(forge.value.shape).toBe(first.shape);
    expect(forge.value.paletteId).toBe(first.palette);
    press(forge, '[data-action="shuffle"]');
    expect(forge.querySelector<HTMLElement>('[data-ui-part="variation"]')?.dataset.seed).toBe("13");
  });

  it("keeps focus while typing the name and accepts a partial value", async () => {
    const forge = make(`value='{"name":"Acme Cuts","shape":"circle"}'`);
    expect(forge.value.shape).toBe("circle");
    const input = forge.querySelector<HTMLInputElement>('input[data-field="name"]')!;
    input.focus();
    await userEvent.keyboard("!");
    expect(document.activeElement).toBe(input);
    expect(forge.value.name).toBe("Acme Cuts!");
    expect(forge.mark?.label).toContain("Acme Cuts!");
  });

  it("copies the SVG source and reports it in the live region", async () => {
    const forge = make();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    press(forge, '[data-action="copy"]');
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^<svg /);
    await vi.waitFor(() =>
      expect(forge.querySelector('[role="status"]')?.textContent).toBe(
        "SVG copied to the clipboard",
      ),
    );
  });

  it("switches language through the strings registry", async () => {
    const forge = make();
    expect(forge.querySelector('[data-action="shuffle"]')?.textContent).toBe("Shuffle");
    document.documentElement.lang = "es-PE";
    await loadStrings("es");
    expect(forge.querySelector('[data-action="shuffle"]')?.textContent).toBe("Mezclar");
    expect(forge.getAttribute("aria-label")).toBe("Generador de logotipos");
    document.documentElement.lang = "";
  });
});
