import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineSource } from "../src/source/source.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineSource();
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** Polls until `check` holds: the safe-URL module loads lazily. */
async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await wait(25);
}

const chips = (el: Element) => {
  const root = el.shadowRoot as ShadowRoot;
  return {
    link: root.querySelector("a") as HTMLAnchorElement,
    button: root.querySelector("button") as HTMLButtonElement,
    card: root.querySelector("[part=card]") as HTMLElement,
  };
};

describe("ui-source", () => {
  it("links http(s) URLs safely and describes the preview", async () => {
    const host = mount(
      `<ui-source index="2" heading="Doc" url="https://www.example.com/a" snippet="Excerpt"></ui-source>`,
    );
    const el = host.querySelector("ui-source")!;
    await until(() => !chips(el).link.hidden);
    const { link, button, card } = chips(el);
    expect(link.hidden).toBe(false);
    expect(button.hidden).toBe(true);
    expect(link.href).toBe("https://www.example.com/a");
    expect(link.rel).toBe("noopener noreferrer nofollow");
    expect(link.target).toBe("_blank");
    expect(link.getAttribute("aria-describedby")).toBe(card.id);
    expect(await ax("link", "2: Doc, example.com")).toBeTruthy();
    expect(card.textContent).toContain("Excerpt");
  });

  it("never links a javascript: or data: URL", async () => {
    const host = mount(`<ui-source heading="x" url="javascript:window.hacked=1"></ui-source>`);
    const el = host.querySelector("ui-source")!;
    await wait(300);
    expect(chips(el).link.hidden).toBe(true);
    expect(chips(el).link.hasAttribute("href")).toBe(false);
    expect(chips(el).button.hidden).toBe(false);
  });

  it("shows the preview on focus and Escape dismisses it", async () => {
    const host = mount(
      `<ui-source heading="Doc" url="https://example.com" snippet="s"></ui-source>`,
    );
    const el = host.querySelector("ui-source")!;
    const { card, link } = chips(el);
    await expect.poll(() => link.hidden, { timeout: 5000 }).toBe(false);
    const visibility = () => getComputedStyle(card).visibility;
    expect(visibility()).toBe("hidden");
    link.focus();
    await expect.poll(visibility, { timeout: 5000 }).toBe("visible");
    link.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await expect.poll(visibility, { timeout: 5000 }).toBe("hidden");
  });

  it("renders a hostile title as text", () => {
    const evil = `<img src=x onerror="window.hacked=1">`;
    const host = mount(`<ui-source url="https://example.com"></ui-source>`);
    const el = host.querySelector("ui-source") as HTMLElement & { heading: string };
    el.heading = evil;
    expect(chips(el).card.querySelectorAll("img").length).toBe(0);
    expect(chips(el).card.textContent).toContain(evil);
  });

  it("names a mailto source by its address", async () => {
    mount(`<ui-source url="mailto:team@example.com"></ui-source>`);
    expect(await ax("link", "team@example.com")).toBeTruthy();
  });
});
