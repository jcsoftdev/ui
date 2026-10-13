import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  type CommandPaletteItem,
  defineCommandPalette,
  type UiCommandPalette,
} from "../src/command-palette/command-palette.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => defineCommandPalette());

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

const PALETTE = `<button id="opener" commandfor="p" command="--open">Search</button>
  <ui-command-palette id="p" label="Command palette" placeholder="Type a command" empty-label="Nothing found"></ui-command-palette>`;

const items = (run = vi.fn()): CommandPaletteItem[] => [
  {
    id: "new-booking",
    label: "New booking",
    group: "Bookings",
    hint: "N",
    onSelect: () => run("new"),
  },
  {
    id: "calendar",
    label: "Open calendar",
    group: "Bookings",
    keywords: ["agenda"],
    onSelect: () => run("calendar"),
  },
  { id: "settings", label: "Settings", group: "Account", onSelect: () => run("settings") },
  { id: "billing", label: "Billing", group: "Account", onSelect: () => run("billing") },
];

const setup = (run = vi.fn()) => {
  const host = mount(PALETTE);
  const palette = host.querySelector<UiCommandPalette>("ui-command-palette")!;
  palette.items = items(run);
  return { host, palette, run };
};
const panel = (host: HTMLElement) => host.querySelector<HTMLDialogElement>("dialog")!;
const input = (host: HTMLElement) => host.querySelector<HTMLInputElement>("[data-ui-part=input]")!;
const labels = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>("[role=option]:not([hidden])")].map(
    (o) => o.dataset.value,
  );

describe("ui-command-palette", () => {
  it("opens modally from an invoker with a named combobox, listbox, groups and focus in the input", async () => {
    const { host, palette } = setup();
    const opened = vi.fn();
    palette.addEventListener("open", opened);
    await userEvent.click(host.querySelector("#opener")!);
    expect(palette.open).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(panel(host).matches(":modal")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(input(host));
    expect(await ax("dialog", "Command palette")).toBeTruthy();
    expect((await ax("combobox", "Command palette"))?.properties.expanded).toBe(true);
    expect(await ax("listbox")).toBeTruthy();
    expect(await ax("group", "Bookings")).toBeTruthy();
    expect(await ax("option", "New booking N")).toBeTruthy();
    expect(input(host).getAttribute("aria-activedescendant")).toBe(
      host.querySelector<HTMLElement>("[data-value=new-booking]")!.id,
    );
    expect(input(host).placeholder).toBe("Type a command");
  });

  it("filters and ranks as you type, announces the count and shows the empty state", async () => {
    const { host } = setup();
    await userEvent.click(host.querySelector("#opener")!);
    const results = host.querySelector("[data-ui-part=results]")!;
    expect(results.textContent).toBe("4 results");
    await userEvent.keyboard("set");
    expect(labels(host)).toEqual(["settings"]);
    expect(results.textContent).toBe("1 results");
    expect(host.querySelector<HTMLElement>("[data-ui-part=group][aria-labelledby]")).toBeTruthy();
    expect(host.querySelectorAll("[role=group]:not([hidden])").length).toBe(1);
    await userEvent.clear(input(host));
    await userEvent.keyboard("agenda");
    expect(labels(host)).toEqual(["calendar"]);
    await userEvent.clear(input(host));
    await userEvent.keyboard("zzz");
    expect(labels(host)).toEqual([]);
    expect(host.querySelector<HTMLElement>("[data-ui-part=empty]")!.hidden).toBe(false);
    expect(host.querySelector("[data-ui-part=empty]")!.textContent).toBe("Nothing found");
  });

  it("runs the active item with Enter, fires select, closes and returns focus", async () => {
    const { host, palette, run } = setup();
    const picked = vi.fn();
    palette.addEventListener("select", (event) => picked((event as CustomEvent).detail.id));
    const opener = host.querySelector<HTMLElement>("#opener")!;
    await userEvent.click(opener);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(picked).toHaveBeenCalledWith("settings");
    expect(run).toHaveBeenCalledWith("settings");
    expect(palette.open).toBe(false);
    await wait(250);
    expect(panel(host).open).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    await userEvent.click(opener);
    expect(input(host).value).toBe("");
  });

  it("runs an item by click, and a prevented select keeps it open", async () => {
    const { host, palette, run } = setup();
    palette.addEventListener("select", (event) => event.preventDefault(), { once: true });
    await userEvent.click(host.querySelector("#opener")!);
    await userEvent.click(host.querySelector("[data-value=billing]")!);
    expect(run).not.toHaveBeenCalled();
    expect(palette.open).toBe(true);
    await userEvent.click(host.querySelector("[data-value=billing]")!);
    expect(run).toHaveBeenCalledWith("billing");
    expect(palette.open).toBe(false);
  });

  it("closes on Escape and on a press on the backdrop", async () => {
    const { host, palette } = setup();
    const closed = vi.fn();
    palette.addEventListener("close", closed);
    await userEvent.click(host.querySelector("#opener")!);
    await userEvent.keyboard("{Escape}");
    expect(palette.open).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    await wait(250);
    palette.show();
    const box = panel(host).getBoundingClientRect();
    panel(host).dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: box.left - 10,
        clientY: box.top + 5,
      }),
    );
    panel(host).dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: box.left - 10, clientY: box.top + 5 }),
    );
    expect(palette.open).toBe(false);
  });

  it("reads declarative items and a controlled query", async () => {
    const host = mount(`<ui-command-palette label="Go to" query="gui">
        <ui-command-palette-item value="guide" group="Docs" hint="G">Guide</ui-command-palette-item>
        <ui-command-palette-item value="home" group="Docs">Home</ui-command-palette-item>
      </ui-command-palette>`);
    const palette = host.querySelector<UiCommandPalette>("ui-command-palette")!;
    palette.show();
    await wait(50);
    expect(input(host).value).toBe("gui");
    expect(labels(host)).toEqual(["guide"]);
    palette.query = "";
    expect(labels(host)).toEqual(["guide", "home"]);
    palette.formatResultCount = (count) => `${count} resultados`;
    palette.query = "h";
    expect(host.querySelector("[data-ui-part=results]")!.textContent).toMatch(/resultados$/);
  });

  it("works under a custom prefix", async () => {
    defineCommandPalette({ prefix: "acme" });
    const host = mount(
      `<acme-command-palette label="Find"><acme-command-palette-item value="a">Alpha</acme-command-palette-item></acme-command-palette>`,
    );
    host.querySelector<UiCommandPalette>("acme-command-palette")!.show();
    await wait(50);
    expect(await ax("dialog", "Find")).toBeTruthy();
    expect(labels(host)).toEqual(["a"]);
  });
});
