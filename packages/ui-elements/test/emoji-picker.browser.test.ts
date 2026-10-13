import type { EmojiCategory } from "@jcsoftdev/ui-core/emoji";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineEmojiPicker, type UiEmojiPicker } from "../src/emoji-picker/emoji-picker.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineEmojiPicker();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const datasetFetched = () =>
  performance.getEntriesByType("resource").some((entry) => entry.name.includes("emoji-data"));

/** 2,000 distinct emoji-like entries, enough to need a virtual grid. */
const BIG: EmojiCategory[] = [
  {
    id: "all",
    label: "All",
    icon: "★",
    emojis: Array.from({ length: 2000 }, (_, i) => ({
      emoji: String.fromCodePoint(0x4e00 + i),
      name: `glyph number ${i} extra words`,
    })),
  },
];

const cells = (picker: Element) => picker.querySelectorAll<HTMLElement>("button[data-index]");

describe("ui-emoji-picker", () => {
  // Runs first on purpose: the dataset chunk must not be fetched while every picker has its own data.
  it("never fetches the built-in dataset when it is given its own categories", async () => {
    const picker = document.createElement("ui-emoji-picker") as UiEmojiPicker;
    picker.categories = BIG;
    mount("").append(picker);
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    expect(datasetFetched()).toBe(false);
  });

  it("loads the built-in dataset lazily and shows its first category in a labelled grid", async () => {
    const host = mount(`<ui-emoji-picker placeholder="Buscar emoji"></ui-emoji-picker>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    expect(picker.getAttribute("aria-busy")).toBe("true");
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(10));
    expect(datasetFetched()).toBe(true);
    expect(picker.hasAttribute("aria-busy")).toBe(false);
    expect(await ax("grid", "Caras")).toBeTruthy();
    expect(await ax("searchbox", "Buscar emoji")).toBeTruthy();
    expect(await ax("toolbar", "Categorías")).toBeTruthy();
    expect(await ax("button", "Gestos")).toBeTruthy();
  });

  it("switches category, reflecting aria-pressed and the grid title", async () => {
    const host = mount(`<ui-emoji-picker></ui-emoji-picker>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    const gestures = picker.querySelector<HTMLElement>('[data-category="gestos"]')!;
    await userEvent.click(gestures);
    expect(picker.querySelector('[data-category="gestos"]')).toBe(gestures);
    expect(gestures.getAttribute("aria-pressed")).toBe("true");
    expect(picker.querySelector('[data-category="caras"]')!.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(await ax("grid", "Gestos")).toBeTruthy();
  });

  it("searches across categories ignoring case and accents, and reports no results", async () => {
    const host = mount(`<ui-emoji-picker></ui-emoji-picker>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    const input = picker.querySelector("input")!;
    await userEvent.fill(input, "GUIÑO");
    await vi.waitFor(() => expect(cells(picker).length).toBe(1));
    expect(cells(picker)[0]?.getAttribute("aria-label")).toBe("guiño");
    expect(picker.querySelector<HTMLElement>('[data-ui-part="categories"]')!.hidden).toBe(true);
    expect(await ax("grid", "Resultados (1)")).toBeTruthy();
    await userEvent.fill(input, "zzzzzz");
    await vi.waitFor(() =>
      expect(picker.querySelector<HTMLElement>('[data-ui-part="empty"]')!.hidden).toBe(false),
    );
    expect(cells(picker).length).toBe(0);
  });

  it("virtualises the grid: only the visible rows exist, yet the whole list is reachable by keyboard", async () => {
    const host = mount(`<ui-emoji-picker style="width:300px"></ui-emoji-picker>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    picker.categories = BIG;
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    expect(cells(picker).length).toBeLessThan(120);
    const grid = picker.querySelector('[role="grid"]')!;
    const columns = Number(grid.getAttribute("aria-colcount"));
    expect(columns).toBeGreaterThan(3);
    expect(Number(grid.getAttribute("aria-rowcount"))).toBe(Math.ceil(2000 / columns));
    // One tab stop (roving), on the first cell.
    expect([...cells(picker)].filter((cell) => cell.tabIndex === 0).length).toBe(1);
    cells(picker)[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("data-index")).toBe("1");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("data-index")).toBe(String(1 + columns));
    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement?.getAttribute("data-index")).toBe("0");
    await userEvent.keyboard("{End}");
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("data-index")).toBe("1999"));
    expect(cells(picker).length).toBeLessThan(120);
    await userEvent.keyboard("{Home}");
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("data-index")).toBe("0"));
  });

  it("picks with Enter and Space and with a click, and never submits an enclosing form", async () => {
    const host = mount(`<form><ui-emoji-picker></ui-emoji-picker></form>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    picker.categories = BIG;
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    const submit = vi.fn((event: Event) => event.preventDefault());
    host.querySelector("form")!.addEventListener("submit", submit);
    const picked: string[] = [];
    picker.addEventListener("emoji-select", (event) =>
      picked.push((event as CustomEvent<{ emoji: string }>).detail.emoji),
    );
    cells(picker)[2]!.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await userEvent.click(cells(picker)[0]!);
    expect(picked).toEqual([
      BIG[0]!.emojis[2]!.emoji,
      BIG[0]!.emojis[2]!.emoji,
      BIG[0]!.emojis[0]!.emoji,
    ]);
    picker.querySelector("input")!.focus();
    await userEvent.keyboard("{Enter}");
    expect(submit).not.toHaveBeenCalled();
    expect([...new FormData(host.querySelector("form")!).keys()].filter((key) => key)).toEqual([]);
  });

  it("does not mistake the search field's native select event for a pick, and pages with PageUp and PageDown", async () => {
    const host = mount(`<ui-emoji-picker style="width:300px"></ui-emoji-picker>`);
    const picker = host.querySelector<UiEmojiPicker>("ui-emoji-picker")!;
    picker.categories = BIG;
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    const events: string[] = [];
    host.addEventListener("select", () => events.push("select"));
    host.addEventListener("emoji-select", () => events.push("emoji-select"));
    const input = picker.querySelector("input")!;
    await userEvent.fill(input, "glyph");
    input.select();
    await vi.waitFor(() => expect(cells(picker).length).toBeGreaterThan(0));
    expect(events).toEqual([]);
    cells(picker)[0]!.focus();
    await userEvent.keyboard("{PageDown}");
    await vi.waitFor(() =>
      expect(Number(document.activeElement?.getAttribute("data-index"))).toBeGreaterThan(8),
    );
    await userEvent.keyboard("{PageUp}");
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("data-index")).toBe("0"));
  });

  it("registers under a custom prefix", () => {
    expect(defineEmojiPicker({ prefix: "acme" })).toBe("acme-emoji-picker");
  });
});
