import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineContextMenu, type UiContextMenu } from "../src/context-menu/context-menu.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => defineContextMenu());

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

const AREA = `<button id="before">Before</button>
  <ui-context-menu id="area" style="display:block;width:300px;height:200px">
    <button id="inside">Row</button>
    <ui-context-menu-content>
      <ui-context-menu-item id="copy">Copy</ui-context-menu-item>
      <ui-context-menu-item id="del" tone="danger">Delete</ui-context-menu-item>
      <ui-context-menu-separator></ui-context-menu-separator>
      <ui-context-menu-checkbox-item id="pin">Pin</ui-context-menu-checkbox-item>
    </ui-context-menu-content>
  </ui-context-menu>`;

const rightClick = (target: Element, x: number, y: number) =>
  target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }),
  );

describe("ui-context-menu", () => {
  it("opens at the pointer on contextmenu, names the menu and focuses it", async () => {
    const host = mount(AREA);
    const menu = host.querySelector<UiContextMenu>("ui-context-menu")!;
    const content = host.querySelector<HTMLElement>("ui-context-menu-content")!;
    const notPrevented = rightClick(host.querySelector("#inside")!, 120, 90);
    expect(notPrevented).toBe(false);
    await wait(200);
    expect(menu.open).toBe(true);
    expect(content.matches(":popover-open")).toBe(true);
    const box = content.getBoundingClientRect();
    expect(Math.abs(box.left - 120)).toBeLessThan(2);
    expect(Math.abs(box.top - 92)).toBeLessThan(3);
    expect(document.activeElement).toBe(content);
    expect(await ax("menu")).toBeTruthy();
    expect(await ax("menuitem", "Copy")).toBeTruthy();
    expect((await ax("menuitemcheckbox", "Pin"))?.properties.checked).toBe("false");
  });

  it("is non-modal, navigates by keyboard and returns focus to where it was", async () => {
    const host = mount(AREA);
    const menu = host.querySelector<UiContextMenu>("ui-context-menu")!;
    const picked = vi.fn();
    host.addEventListener("select", (event) => picked((event.target as HTMLElement).id));
    const inside = host.querySelector<HTMLElement>("#inside")!;
    inside.focus();
    rightClick(inside, 40, 40);
    await frame();
    expect(host.querySelector("#before")!.closest("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(picked).toHaveBeenCalledWith("del");
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(inside);
  });

  it("opens from the keyboard (Shift+F10) and closes with Escape", async () => {
    const host = mount(AREA);
    const menu = host.querySelector<UiContextMenu>("ui-context-menu")!;
    const inside = host.querySelector<HTMLElement>("#inside")!;
    inside.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(menu.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(inside);
  });

  it("dismisses on an outside press without stealing focus, and a second right-click moves it", async () => {
    const host = mount(AREA);
    const menu = host.querySelector<UiContextMenu>("ui-context-menu")!;
    const content = host.querySelector<HTMLElement>("ui-context-menu-content")!;
    rightClick(host.querySelector("#inside")!, 30, 30);
    await wait(30);
    expect(menu.open).toBe(true);
    menu.showAt(100, 80);
    await wait(200);
    expect(Math.abs(content.getBoundingClientRect().left - 100)).toBeLessThan(2);
    const before = host.querySelector<HTMLElement>("#before")!;
    await userEvent.click(before);
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  it("toggles a checkbox item with a change event", async () => {
    const host = mount(AREA);
    const changes: unknown[] = [];
    host.addEventListener("change", (event) => changes.push((event as CustomEvent).detail));
    rightClick(host.querySelector("#inside")!, 60, 60);
    await frame();
    await userEvent.click(host.querySelector("#pin")!);
    expect(changes).toEqual([{ checked: true }]);
    expect(host.querySelector("#pin")!.hasAttribute("checked")).toBe(true);
  });
});
