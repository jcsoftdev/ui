import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import { defineDropdownMenu, type UiDropdownMenu } from "../src/dropdown-menu/dropdown-menu.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineDropdownMenu();
  defineDialog();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

const MENU = (attrs = "") => `
  <p id="outside">Page</p>
  <ui-dropdown-menu id="menu" ${attrs}>
    <button id="trigger">Options</button>
    <ui-dropdown-menu-content>
      <ui-dropdown-menu-label>Account</ui-dropdown-menu-label>
      <ui-dropdown-menu-item id="profile">Profile</ui-dropdown-menu-item>
      <ui-dropdown-menu-item id="off" disabled>Billing</ui-dropdown-menu-item>
      <ui-dropdown-menu-item id="settings">Settings <ui-dropdown-menu-shortcut>Ctrl+,</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-checkbox-item id="bar" checked>Show bar</ui-dropdown-menu-checkbox-item>
      <ui-dropdown-menu-radio-group id="sort" value="name">
        <ui-dropdown-menu-radio-item id="byname" value="name">Name</ui-dropdown-menu-radio-item>
        <ui-dropdown-menu-radio-item id="bydate" value="date">Date</ui-dropdown-menu-radio-item>
      </ui-dropdown-menu-radio-group>
      <ui-dropdown-menu-sub id="more">
        <ui-dropdown-menu-sub-trigger id="moretrigger">More</ui-dropdown-menu-sub-trigger>
        <ui-dropdown-menu-sub-content>
          <ui-dropdown-menu-item id="export">Export</ui-dropdown-menu-item>
          <ui-dropdown-menu-item id="import">Import</ui-dropdown-menu-item>
        </ui-dropdown-menu-sub-content>
      </ui-dropdown-menu-sub>
    </ui-dropdown-menu-content>
  </ui-dropdown-menu>`;

const content = (host: HTMLElement) => host.querySelector<HTMLElement>("ui-dropdown-menu-content")!;
const active = () => document.activeElement as HTMLElement | null;

describe("ui-dropdown-menu", () => {
  it("opens from the trigger with the menu button ARIA wiring and the real AX roles", async () => {
    const host = mount(MENU());
    const trigger = host.querySelector<HTMLElement>("#trigger")!;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector("ui-dropdown-menu")!.hasAttribute("open")).toBe(true);
    expect(content(host).matches(":popover-open")).toBe(true);
    expect(trigger.getAttribute("aria-controls")).toBe(content(host).id);
    expect(await ax("menu", "Options")).toBeTruthy();
    expect(await ax("menuitem", "Profile")).toBeTruthy();
    expect((await ax("menuitem", "Billing"))?.properties.disabled).toBe(true);
    expect((await ax("menuitemcheckbox", "Show bar"))?.properties.checked).toBe("true");
    expect((await ax("menuitemradio", "Name"))?.properties.checked).toBe("true");
    expect((await ax("menuitemradio", "Date"))?.properties.checked).toBe("false");
    expect((await ax("menuitem", "More"))?.properties.hasPopup).toBeTruthy();
  });

  it("opens with the keyboard, roves, types ahead, selects and returns focus", async () => {
    const host = mount(MENU());
    const trigger = host.querySelector<HTMLElement>("#trigger")!;
    const picked = vi.fn();
    host.addEventListener("select", (event) => picked((event.target as HTMLElement).id));
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(content(host).matches(":popover-open")).toBe(true);
    expect(active()?.id).toBe("profile");
    await userEvent.keyboard("{ArrowDown}");
    expect(active()?.id).toBe("settings");
    await userEvent.keyboard("{End}");
    expect(active()?.id).toBe("moretrigger");
    await userEvent.keyboard("{Home}");
    expect(active()?.id).toBe("profile");
    await userEvent.keyboard("s");
    expect(active()?.id).toBe("settings");
    await userEvent.keyboard("{Enter}");
    expect(picked).toHaveBeenCalledWith("settings");
    expect(content(host).hasAttribute("open")).toBe(false);
    await wait(250);
    expect(content(host).matches(":popover-open")).toBe(false);
    expect(active()?.id).toBe("trigger");
  });

  it("keeps the menu open when select is prevented, and toggles checkbox and radio items", async () => {
    const host = mount(MENU());
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    const changes: unknown[] = [];
    host.addEventListener("change", (event) => changes.push((event as CustomEvent).detail));
    host.addEventListener("select", (event) => event.preventDefault());
    menu.show("first");
    await frame();
    const bar = host.querySelector<HTMLElement>("#bar")!;
    await userEvent.click(bar);
    expect(bar.getAttribute("aria-checked")).toBe("false");
    expect(bar.hasAttribute("checked")).toBe(false);
    const date = host.querySelector<HTMLElement>("#bydate")!;
    await userEvent.click(date);
    expect(host.querySelector("#sort")!.getAttribute("value")).toBe("date");
    expect(date.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector("#byname")!.getAttribute("aria-checked")).toBe("false");
    expect(changes).toEqual([{ checked: false }, { value: "date" }]);
    expect(menu.open).toBe(true);
  });

  it("opens a submenu with the arrow, closes it with Escape first and the menu second", async () => {
    const host = mount(MENU());
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    menu.show("first");
    await frame();
    const trigger = host.querySelector<HTMLElement>("#moretrigger")!;
    trigger.focus();
    await userEvent.keyboard("{ArrowRight}");
    const sub = host.querySelector<HTMLElement>("ui-dropdown-menu-sub-content")!;
    expect(sub.matches(":popover-open")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(active()?.id).toBe("export");
    await userEvent.keyboard("{ArrowLeft}");
    await wait(200);
    expect(sub.matches(":popover-open")).toBe(false);
    expect(active()?.id).toBe("moretrigger");
    await userEvent.keyboard("{ArrowRight}");
    expect(active()?.id).toBe("export");
    await userEvent.keyboard("{Escape}");
    expect(sub.hasAttribute("open")).toBe(false);
    expect(menu.open).toBe(true);
    expect(active()?.id).toBe("moretrigger");
    await userEvent.keyboard("{Escape}");
    expect(menu.open).toBe(false);
  });

  it("chooses an item of a submenu and closes the whole menu", async () => {
    const host = mount(MENU());
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    const picked = vi.fn();
    host.addEventListener("select", (event) => picked((event.target as HTMLElement).id));
    menu.show("first");
    await frame();
    await userEvent.click(host.querySelector("#moretrigger")!);
    await frame();
    await userEvent.click(host.querySelector("#import")!);
    expect(picked).toHaveBeenCalledWith("import");
    expect(menu.open).toBe(false);
    expect(host.querySelector("ui-dropdown-menu-sub-content")!.hasAttribute("open")).toBe(false);
  });

  it("dismisses on an outside press, and is modal by default: page inert, scroll locked", async () => {
    const host = mount(MENU());
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    menu.show("first");
    await vi.waitFor(() => expect(host.querySelector("#outside")!.closest("[inert]")).toBeTruthy());
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.pointerEvents).toBe("none");
    expect(content(host).closest("[inert]")).toBeNull();
    await userEvent.click(document.documentElement);
    expect(menu.open).toBe(false);
    await vi.waitFor(() => expect(document.body.style.overflow).toBe(""));
    expect(document.body.style.pointerEvents).toBe("");
    expect(host.querySelector("#outside")!.closest("[inert]")).toBeNull();
  });

  it('does not lock the page with modal="false"', async () => {
    const host = mount(MENU('modal="false"'));
    host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!.show("first");
    await wait(100);
    expect(host.querySelector("#outside")!.closest("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes inside a modal dialog on Escape without closing the dialog", async () => {
    const host = mount(`<ui-dialog id="d"><div data-dialog-body>${MENU()}</div></ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    dialog.show();
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    await userEvent.click(host.querySelector("#trigger")!);
    expect(menu.open).toBe(true);
    expect(content(host).matches(":popover-open")).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(menu.open).toBe(false);
    expect(dialog.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });

  it("keeps the content up until the exit animation ends, and reopens during it", async () => {
    const host = mount(MENU());
    const menu = host.querySelector<UiDropdownMenu>("ui-dropdown-menu")!;
    menu.show("first");
    await frame();
    menu.hide();
    expect(content(host).dataset.state).toBe("closed");
    expect(content(host).matches(":popover-open")).toBe(true);
    menu.show("first");
    await wait(250);
    expect(content(host).matches(":popover-open")).toBe(true);
    menu.hide();
    await wait(250);
    expect(content(host).matches(":popover-open")).toBe(false);
  });

  it("works under a custom prefix", async () => {
    defineDropdownMenu({ prefix: "acme" });
    const host = mount(`<acme-dropdown-menu><button id="t">Go</button>
      <acme-dropdown-menu-content><acme-dropdown-menu-item id="one">One</acme-dropdown-menu-item></acme-dropdown-menu-content>
    </acme-dropdown-menu>`);
    await userEvent.click(host.querySelector("#t")!);
    expect(host.querySelector("acme-dropdown-menu-content")!.matches(":popover-open")).toBe(true);
    expect(await ax("menuitem", "One")).toBeTruthy();
  });
});
