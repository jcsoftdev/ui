import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import { definePopover, type UiPopover } from "../src/popover/popover.ts";
import { defineTooltip, type UiTooltip } from "../src/tooltip/tooltip.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineDialog();
  definePopover();
  defineTooltip();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.overflow = "";
});

const DIALOG = `<button id="opener" commandfor="d" command="--open">Open</button>
  <ui-dialog id="d">
    <div data-dialog-header><h2 data-dialog-title>Delete booking</h2></div>
    <div data-dialog-body><p data-dialog-description>This cannot be undone.</p>
      <input id="field" aria-label="Reason"></div>
    <div data-dialog-footer><button data-dialog-close id="cancel">Cancel</button></div>
  </ui-dialog>`;

describe("ui-dialog", () => {
  it("opens modally from an invoker, is named and described, locks scroll and returns focus", async () => {
    const host = mount(DIALOG);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    const opened = vi.fn();
    dialog.addEventListener("open", opened);
    await userEvent.click(host.querySelector("#opener")!);
    expect(dialog.open).toBe(true);
    expect(dialog.panel?.matches(":modal")).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    const node = await ax("dialog", "Delete booking");
    expect(node).toBeTruthy();
    expect(dialog.panel?.getAttribute("aria-describedby")).toBe(
      host.querySelector("[data-dialog-description]")!.id,
    );
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(dialog.panel?.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement?.id).toBe("opener");
  });

  it("closes from data-dialog-close and the X, lets cancel veto, and blocking ignores Escape", async () => {
    const host = mount(DIALOG);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    await userEvent.click(host.querySelector("#cancel")!);
    expect(dialog.open).toBe(false);
    dialog.show();
    const close = dialog.querySelector<HTMLButtonElement>("[data-ui-part=close]")!;
    expect(close.getAttribute("aria-label")).toBe("Close");
    const veto = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", veto);
    await userEvent.click(close);
    expect(dialog.open).toBe(true);
    dialog.removeEventListener("cancel", veto);
    await userEvent.click(close);
    expect(dialog.open).toBe(false);
    dialog.setAttribute("blocking", "");
    dialog.show();
    expect(dialog.querySelector("[data-ui-part=close]")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(true);
    dialog.close();
  });

  it("dismisses on a backdrop press but not on a press inside", async () => {
    const host = mount(DIALOG);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    await userEvent.click(host.querySelector("#field")!);
    expect(dialog.open).toBe(true);
    await userEvent.click(document.body, { position: { x: 5, y: 5 } });
    expect(dialog.open).toBe(false);
  });
});

describe("ui-popover", () => {
  it("opens from popovertarget below its trigger, moves focus in, light-dismisses and returns focus", async () => {
    const host =
      mount(`<button id="t" popovertarget="p" style="position:fixed;left:40px;top:40px">Menu</button>
      <ui-popover id="p"><button id="first">First</button></ui-popover><p id="out">out</p>`);
    const popover = host.querySelector<UiPopover>("ui-popover")!;
    const trigger = host.querySelector<HTMLElement>("#t")!;
    await userEvent.click(trigger);
    await frame();
    expect(popover.open).toBe(true);
    expect(popover.matches(":popover-open")).toBe(true);
    expect(popover.dataset.side).toBe("bottom");
    expect(Math.round(popover.getBoundingClientRect().top)).toBe(
      Math.round(trigger.getBoundingClientRect().bottom + 6),
    );
    expect(document.activeElement?.id).toBe("first");
    expect((await ax("button", "Menu"))?.properties.expanded).toBe(true);
    await userEvent.keyboard("{Escape}");
    await Promise.resolve();
    expect(popover.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    popover.show(trigger);
    expect(popover.open).toBe(true);
    await userEvent.click(host.querySelector("#out")!);
    await Promise.resolve();
    expect(popover.open).toBe(false);
  });
});

describe("ui-tooltip", () => {
  it("describes its anchor, shows on keyboard focus and hover, and hides on Escape and leave", async () => {
    const host =
      mount(`<button id="a" style="margin-top:120px">Save</button><button id="b">Other</button>
      <ui-tooltip for="a" delay="50" arrow>Saves the draft</ui-tooltip>`);
    const tooltip = host.querySelector<UiTooltip>("ui-tooltip")!;
    const anchor = host.querySelector<HTMLElement>("#a")!;
    expect(anchor.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(await ax("button", "Save")).toBeTruthy();
    host.querySelector<HTMLElement>("#b")!.focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(anchor);
    expect(tooltip.open).toBe(true);
    expect(tooltip.dataset.side).toBe("top");
    expect(await ax("tooltip", "Saves the draft")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(tooltip.open).toBe(false);
    // Past the skip window, a hover waits for the delay again.
    await wait(350);
    await userEvent.hover(anchor);
    expect(tooltip.open).toBe(false);
    await wait(80);
    expect(tooltip.open).toBe(true);
    // The pointer can move onto the tooltip (WCAG 1.4.13); leaving both closes it after a grace.
    await userEvent.hover(tooltip);
    await wait(150);
    expect(tooltip.open).toBe(true);
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } });
    await wait(150);
    expect(tooltip.open).toBe(false);
    tooltip.remove();
    expect(anchor.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("overlay regressions", () => {
  it("keeps a dialog open when an overlay inside it closes, and Escape closes only the inner dialog", async () => {
    const host = mount(`<ui-dialog id="outer"><p data-dialog-title>Outer</p>
      <button id="tip-anchor">i</button><ui-tooltip for="tip-anchor">Tip</ui-tooltip>
      <ui-dialog id="inner"><p data-dialog-title>Inner</p><button data-dialog-close id="inner-close">x</button></ui-dialog>
    </ui-dialog>`);
    const outer = host.querySelector<UiDialog>("#outer")!;
    const inner = host.querySelector<UiDialog>("#inner")!;
    const tooltip = host.querySelector<UiTooltip>("ui-tooltip")!;
    outer.show();
    tooltip.show();
    tooltip.hide();
    expect(outer.open).toBe(true);
    inner.show();
    await userEvent.keyboard("{Escape}");
    expect(inner.open).toBe(false);
    expect(outer.open).toBe(true);
    inner.show();
    await userEvent.click(host.querySelector("#inner-close")!);
    expect(inner.open).toBe(false);
    expect(outer.open).toBe(true);
    outer.close();
  });

  it("settles a native close (form method=dialog): scroll unlocked, close event fired", async () => {
    const host = mount(`<ui-dialog><p data-dialog-title>T</p>
      <form method="dialog"><button id="done">Done</button></form></ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    const closed = vi.fn();
    dialog.addEventListener("close", closed);
    dialog.show();
    await userEvent.click(host.querySelector("#done")!);
    await wait(0);
    expect(dialog.open).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("stays open when an open dialog is moved in the DOM", async () => {
    const host = mount(
      `<div id="a"><ui-dialog><p data-dialog-title>T</p></ui-dialog></div><div id="b"></div>`,
    );
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    host.querySelector("#b")!.append(dialog);
    await wait(0);
    expect(dialog.open).toBe(true);
    expect(dialog.panel?.open).toBe(true);
    dialog.close();
  });

  it("shows overlays whose markup starts open, and re-shows a popover moved while open", async () => {
    const host = mount(
      `<button id="t">t</button><ui-popover id="p" open anchor="t">Hi</ui-popover><div id="b"></div>`,
    );
    const popover = host.querySelector<UiPopover>("ui-popover")!;
    expect(popover.matches(":popover-open")).toBe(true);
    host.querySelector("#b")!.append(popover);
    expect(popover.open).toBe(true);
    expect(popover.matches(":popover-open")).toBe(true);
    popover.hide();
    expect(popover.matches(":popover-open")).toBe(false);
    await frame();
  });
});
