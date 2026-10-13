import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import {
  defineEmojiReactionBar,
  type UiEmojiReactionBar,
} from "../src/emoji-reaction-bar/emoji-reaction-bar.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineEmojiReactionBar();
  defineDialog();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const REACTIONS = [
  { emoji: "👍", count: 2, reacted: true },
  { emoji: "🔥", count: 5 },
];

function bar(html = `<ui-emoji-reaction-bar></ui-emoji-reaction-bar>`) {
  const host = mount(html);
  const el = host.querySelector<UiEmojiReactionBar>("ui-emoji-reaction-bar")!;
  el.reactions = REACTIONS;
  return { host, el };
}

const popover = (el: Element) => el.querySelector<HTMLElement>("[data-ui-part=popover]");

describe("ui-emoji-reaction-bar", () => {
  it("renders a pressed-state chip per reaction and an add button, from the property or JSON", async () => {
    const { el } = bar();
    expect(await ax("button", "👍 2")).toBeTruthy();
    expect((await ax("button", "🔥 5"))?.properties.pressed).toBe("false");
    expect(await ax("button", "Añadir reacción")).toBeTruthy();
    el.reactions = [{ emoji: "🎉", count: 1 }];
    expect(el.querySelectorAll("ui-emoji-reaction").length).toBe(1);
    el.removeAttribute("reactions");
    const json = mount(
      `<ui-emoji-reaction-bar add-label="Add" reactions='[{"emoji":"🙏","count":9}]'></ui-emoji-reaction-bar>`,
    );
    expect(await ax("button", "🙏 9")).toBeTruthy();
    expect(await ax("button", "Add")).toBeTruthy();
    expect(json.querySelectorAll("ui-emoji-reaction").length).toBe(1);
  });

  it("fires react with the new state from a chip and leaves the counts to the app", async () => {
    const { el } = bar();
    const react = vi.fn((event: Event) => (event as CustomEvent).detail);
    el.addEventListener("react", react);
    await userEvent.click(el.querySelector('[data-emoji="🔥"]')!);
    await userEvent.click(el.querySelector('[data-emoji="👍"]')!);
    expect(react.mock.results.map((result) => result.value)).toEqual([
      { emoji: "🔥", reacted: true },
      { emoji: "👍", reacted: false },
    ]);
    expect(el.reactions).toEqual(REACTIONS);
  });

  it("opens the picker in a popover on demand, picks, closes and returns focus to the add button", async () => {
    const { el } = bar();
    expect(popover(el)).toBeNull();
    const add = el.querySelector<HTMLButtonElement>("[data-ui-part=add]")!;
    const react = vi.fn((event: Event) => (event as CustomEvent).detail);
    el.addEventListener("react", react);
    await userEvent.click(add);
    await vi.waitFor(() => expect(popover(el)?.matches(":popover-open")).toBe(true));
    expect(add.getAttribute("aria-expanded")).toBe("true");
    const picker = el.querySelector("ui-emoji-picker")!;
    await vi.waitFor(() =>
      expect(picker.querySelectorAll("button[data-index]").length).toBeGreaterThan(0),
    );
    expect(picker.contains(document.activeElement)).toBe(true);
    await userEvent.click(picker.querySelector('button[aria-label="sonrisa feliz"]')!);
    expect(react).toHaveBeenCalledWith(expect.objectContaining({ type: "react" }));
    expect(react.mock.results[0]?.value).toEqual({ emoji: "😀", reacted: true });
    await vi.waitFor(() => expect(popover(el)?.matches(":popover-open")).toBe(false));
    expect(add.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(add);
  });

  it("picking an emoji the user already used reports the toggle off", async () => {
    const { el } = bar();
    const react = vi.fn((event: Event) => (event as CustomEvent).detail);
    el.addEventListener("react", react);
    await userEvent.click(el.querySelector("[data-ui-part=add]")!);
    await vi.waitFor(() => expect(popover(el)?.matches(":popover-open")).toBe(true));
    const picker = el.querySelector("ui-emoji-picker")!;
    await vi.waitFor(() =>
      expect(picker.querySelectorAll("button[data-index]").length).toBeGreaterThan(0),
    );
    el.reactions = [{ emoji: "😀", count: 1, reacted: true }];
    await userEvent.click(picker.querySelector('button[aria-label="sonrisa feliz"]')!);
    expect(react.mock.results[0]?.value).toEqual({ emoji: "😀", reacted: false });
  });

  it("Escape closes the picker first and an enclosing dialog second", async () => {
    const { host, el } = bar(`<ui-dialog id="dlg"><div data-dialog-body>
        <ui-emoji-reaction-bar></ui-emoji-reaction-bar></div></ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    await userEvent.click(el.querySelector("[data-ui-part=add]")!);
    await vi.waitFor(() => expect(popover(el)?.matches(":popover-open")).toBe(true));
    await userEvent.keyboard("{Escape}");
    expect(popover(el)?.matches(":popover-open")).toBe(false);
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(el.querySelector("[data-ui-part=add]"));
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });

  it("disables every chip and the add button, and works outside any form without submitting one", async () => {
    const { host, el } = bar(`<form><ui-emoji-reaction-bar></ui-emoji-reaction-bar></form>`);
    const submit = vi.fn((event: Event) => event.preventDefault());
    host.querySelector("form")!.addEventListener("submit", submit);
    await userEvent.click(el.querySelector('[data-emoji="🔥"]')!);
    await userEvent.click(el.querySelector("[data-ui-part=add]")!);
    expect(submit).not.toHaveBeenCalled();
    expect([...new FormData(host.querySelector("form")!).keys()]).toEqual([]);
    el.disabled = true;
    expect(el.querySelector<HTMLButtonElement>("[data-ui-part=add]")!.disabled).toBe(true);
    expect(
      [...el.querySelectorAll("ui-emoji-reaction")].every((chip) => chip.hasAttribute("disabled")),
    ).toBe(true);
  });

  it("registers the bar and its chip under a custom prefix", () => {
    expect(defineEmojiReactionBar({ prefix: "acme" })).toBe("acme-emoji-reaction-bar");
    expect(customElements.get("acme-emoji-reaction")).toBeTruthy();
  });
});
