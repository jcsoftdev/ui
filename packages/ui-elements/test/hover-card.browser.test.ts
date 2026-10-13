import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import { defineHoverCard, type UiHoverCard } from "../src/hover-card/hover-card.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineHoverCard();
  defineDialog();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--surface-overlay");
});

const CARD = `<a id="t" href="#profile" style="position:fixed;left:60px;top:60px">@ana</a>
  <ui-hover-card id="c" for="t" open-delay="20" close-delay="40">
    <p id="bio">Barber, Lima.</p>
  </ui-hover-card>`;

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, { bubbles: false, pointerType: "mouse", clientX: x, clientY: y });

describe("ui-hover-card", () => {
  it("opens after the hover delay, is a tooltip described from the trigger, and closes after the close delay", async () => {
    const host = mount(CARD);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    const trigger = host.querySelector("#t")!;
    const opened = vi.fn();
    card.addEventListener("open", opened);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    await userEvent.hover(trigger);
    expect(card.open).toBe(false);
    await vi.waitFor(() => expect(card.open).toBe(true));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-describedby")).toBe(card.id);
    expect(await ax("tooltip")).toBeTruthy();
    expect(card.matches(":popover-open")).toBe(true);
    await userEvent.unhover(trigger);
    await vi.waitFor(() => expect(card.open).toBe(false));
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
  });

  it("stays open while the pointer is on the card, and closes once it leaves", async () => {
    const host = mount(CARD);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    await userEvent.hover(host.querySelector("#t")!);
    await vi.waitFor(() => expect(card.open).toBe(true));
    await userEvent.hover(host.querySelector("#bio")!);
    await wait(150);
    expect(card.open).toBe(true);
    await userEvent.unhover(host.querySelector("#bio")!);
    await vi.waitFor(() => expect(card.open).toBe(false));
  });

  it("holds the close while the pointer crosses the grace area toward the card, and not elsewhere", async () => {
    const host = mount(CARD);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    const trigger = host.querySelector("#t") as HTMLElement;
    card.show();
    await wait(30);
    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    expect(c.top).toBeGreaterThanOrEqual(t.bottom);
    // Leave through the bottom edge, then keep moving inside the triangle toward the card.
    trigger.dispatchEvent(pointer("pointerleave", t.left + 10, t.bottom));
    const inside = { x: t.left + 12, y: (t.bottom + c.top) / 2 };
    for (let i = 0; i < 6; i++) {
      document.dispatchEvent(pointer("pointermove", inside.x, inside.y));
      await wait(15);
    }
    expect(card.open).toBe(true);
    // Heading away (outside the area) lets the close go through.
    document.dispatchEvent(pointer("pointermove", c.right + 200, c.bottom + 200));
    await vi.waitFor(() => expect(card.open).toBe(false), { timeout: 1500 });
  });

  it("opens at once on keyboard focus, never takes focus, and closes on blur", async () => {
    const host = mount(`${CARD}<button id="other">Other</button>`);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    const trigger = host.querySelector<HTMLElement>("#t")!;
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    expect(card.open).toBe(true);
    expect(card.contains(document.activeElement)).toBe(false);
    await userEvent.tab();
    expect(card.open).toBe(false);
  });

  it("Escape closes only the card, leaving an enclosing dialog open", async () => {
    const host = mount(`<ui-dialog id="dlg"><div data-dialog-body>
        <a id="t" href="#x">@ana</a>
        <ui-hover-card for="t" open-delay="20"><p>Barber</p></ui-hover-card>
      </div></ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    dialog.show();
    host.querySelector<HTMLElement>("#t")!.focus();
    await vi.waitFor(() => expect(card.open).toBe(true));
    await userEvent.keyboard("{Escape}");
    expect(card.open).toBe(false);
    expect(dialog.open).toBe(true);
    expect(document.activeElement?.id).toBe("t");
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });

  it("uses the surface-overlay surface by default, as the React hover card does", async () => {
    const host = mount(CARD);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    document.documentElement.style.setProperty("--surface-overlay", "rgb(1, 2, 3)");
    card.show();
    const style = getComputedStyle(card);
    expect(style.backgroundColor).toBe("rgb(1, 2, 3)");
    expect(style.width).toBe("288px");
  });

  it("ignores touch pointers", async () => {
    const host = mount(CARD);
    const card = host.querySelector<UiHoverCard>("ui-hover-card")!;
    host
      .querySelector("#t")!
      .dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
    await wait(80);
    expect(card.open).toBe(false);
  });

  it("registers under a custom prefix", () => {
    expect(defineHoverCard({ prefix: "acme" })).toBe("acme-hover-card");
  });
});
