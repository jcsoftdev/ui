import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineEmojiReaction, type UiEmojiReaction } from "../src/emoji-reaction/emoji-reaction.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineEmojiReaction();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-emoji-reaction", () => {
  it("is a toggle button named '<emoji> <count>' with its pressed state in the AX tree", async () => {
    const host = mount(`<ui-emoji-reaction emoji="👍" count="3"></ui-emoji-reaction>`);
    const chip = host.querySelector<UiEmojiReaction>("ui-emoji-reaction")!;
    const node = await ax("button", "👍 3");
    expect(node?.properties.pressed).toBe("false");
    chip.reacted = true;
    chip.count = 4;
    const pressed = await ax("button", "👍 4");
    expect(pressed?.properties.pressed).toBe("true");
  });

  it("toggles on click, Enter and Space, fires change, and never submits a form", async () => {
    const host = mount(`<form><ui-emoji-reaction emoji="🔥" count="1"></ui-emoji-reaction></form>`);
    const chip = host.querySelector<UiEmojiReaction>("ui-emoji-reaction")!;
    const change = vi.fn((event: Event) => (event as CustomEvent).detail);
    const submit = vi.fn((event: Event) => event.preventDefault());
    host.querySelector("form")!.addEventListener("submit", submit);
    chip.addEventListener("change", change);
    await userEvent.click(chip);
    expect(chip.reacted).toBe(true);
    chip.focus();
    await userEvent.keyboard("{Enter}");
    expect(chip.reacted).toBe(false);
    await userEvent.keyboard(" ");
    expect(chip.reacted).toBe(true);
    expect(change).toHaveBeenCalledTimes(3);
    expect(change.mock.results.map((result) => result.value)).toEqual([
      { reacted: true },
      { reacted: false },
      { reacted: true },
    ]);
    expect(submit).not.toHaveBeenCalled();
    expect([...new FormData(host.querySelector("form")!).keys()]).toEqual([]);
  });

  it("ignores presses when disabled and leaves the tab order", async () => {
    const host = mount(`<ui-emoji-reaction emoji="👍" count="0" disabled></ui-emoji-reaction>`);
    const chip = host.querySelector<UiEmojiReaction>("ui-emoji-reaction")!;
    const change = vi.fn();
    chip.addEventListener("change", change);
    await userEvent.click(chip);
    expect(change).not.toHaveBeenCalled();
    expect(chip.hasAttribute("tabindex")).toBe(false);
    expect((await ax("button", "👍 0"))?.properties.disabled).toBe(true);
  });

  it("registers under a custom prefix", () => {
    expect(defineEmojiReaction({ prefix: "acme" })).toBe("acme-emoji-reaction");
  });
});
