import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { bindMenuTrigger, bindSubmenuTrigger, createMenuContent } from "../src/menu.ts";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}
afterEach(() => {
  document.body.innerHTML = "";
});

const MENU = `
  <button id="trigger">menu</button>
  <div id="menu" role="menu">
    <div role="menuitem" id="new">New file</div>
    <div role="menuitem" id="open">Open</div>
    <div role="menuitem" id="off" data-disabled aria-disabled="true">Offline</div>
    <div role="menuitemcheckbox" id="bar" aria-checked="false" data-state="unchecked">Toolbar</div>
    <div role="group">
      <div role="menuitemradio" id="a" aria-checked="true" data-state="checked">Alpha</div>
      <div role="menuitemradio" id="b" aria-checked="false" data-state="unchecked">Beta</div>
    </div>
  </div>`;

describe("createMenuContent", () => {
  it("moves the highlight with arrows, skips disabled items and loops", async () => {
    const host = mount(MENU);
    const menu = createMenuContent(host.querySelector("#menu") as HTMLElement);
    menu.focusEntry("first");
    expect(document.activeElement?.id).toBe("new");
    expect(document.activeElement?.hasAttribute("data-highlighted")).toBe(true);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement?.id).toBe("bar");
    await userEvent.keyboard("{End}{ArrowDown}");
    expect(document.activeElement?.id).toBe("new");
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement?.id).toBe("b");
    menu.focusEntry("none");
    expect(document.activeElement?.id).toBe("menu");
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement?.id).toBe("b");
  });

  it("focuses by typeahead on the item text", async () => {
    const host = mount(MENU);
    const menu = createMenuContent(host.querySelector("#menu") as HTMLElement, {
      typeaheadTimeout: 20,
    });
    menu.focusEntry("first");
    await userEvent.keyboard("t");
    expect(document.activeElement?.id).toBe("bar");
    await tick(60);
    await userEvent.keyboard("o");
    expect(document.activeElement?.id).toBe("open");
  });

  it("selects with Enter and Space, closing through onSelect unless prevented", async () => {
    const host = mount(MENU);
    const onSelect = vi.fn();
    const menu = createMenuContent(host.querySelector("#menu") as HTMLElement, { onSelect });
    menu.focusEntry("first");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    host.querySelector("#open")?.addEventListener("ui.menu.itemSelect", (e) => e.preventDefault());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard(" ");
    expect(host.querySelector("#bar")?.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector("#bar")?.getAttribute("data-state")).toBe("checked");
  });

  it("toggles checkbox items and keeps one radio checked per group", async () => {
    const host = mount(MENU);
    const seen: (boolean | undefined)[] = [];
    host.addEventListener("ui.menu.itemSelect", (e) =>
      seen.push((e as CustomEvent).detail.checked),
    );
    createMenuContent(host.querySelector("#menu") as HTMLElement);
    (host.querySelector("#bar") as HTMLElement).click();
    (host.querySelector("#bar") as HTMLElement).click();
    (host.querySelector("#b") as HTMLElement).click();
    expect(host.querySelector("#a")?.getAttribute("aria-checked")).toBe("false");
    expect(host.querySelector("#b")?.getAttribute("aria-checked")).toBe("true");
    expect(seen).toEqual([true, false, true]);
  });

  it("ignores clicks on disabled items", () => {
    const host = mount(MENU);
    const onSelect = vi.fn();
    createMenuContent(host.querySelector("#menu") as HTMLElement, { onSelect });
    (host.querySelector("#off") as HTMLElement).click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hands Tab to the caller", async () => {
    const host = mount(MENU);
    const onTab = vi.fn();
    const menu = createMenuContent(host.querySelector("#menu") as HTMLElement, { onTab });
    menu.focusEntry("first");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(onTab).toHaveBeenCalledWith(true);
  });
});

describe("bindMenuTrigger", () => {
  it("opens with arrow keys at the matching end and toggles with Enter", async () => {
    const host = mount(MENU);
    const trigger = host.querySelector("#trigger") as HTMLElement;
    let open = false;
    const setOpen = vi.fn((next: boolean) => {
      open = next;
    });
    bindMenuTrigger(trigger, { isOpen: () => open, setOpen });
    trigger.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(setOpen).toHaveBeenLastCalledWith(true, "last");
    await userEvent.keyboard("{Enter}");
    expect(setOpen).toHaveBeenLastCalledWith(false, "first");
  });
});

describe("submenus", () => {
  const SUB = `
    <div id="menu" role="menu">
      <div role="menuitem" id="one">One</div>
      <div role="menuitem" id="sub" aria-haspopup="menu" aria-expanded="false">More</div>
      <div role="menu" id="submenu"><div role="menuitem" id="deep">Deep</div></div>
    </div>`;

  it("opens with ArrowRight at the first item and closes with ArrowLeft back onto the trigger", async () => {
    const host = mount(SUB);
    const sub = host.querySelector("#submenu") as HTMLElement;
    const trigger = host.querySelector("#sub") as HTMLElement;
    const parent = createMenuContent(host.querySelector("#menu") as HTMLElement, { dir: "ltr" });
    let open = false;
    const setOpen = (next: boolean) => {
      open = next;
      sub.hidden = !next;
    };
    sub.hidden = true;
    const child = createMenuContent(sub, {
      dir: "ltr",
      submenu: { trigger, close: () => setOpen(false), parent },
    });
    bindSubmenuTrigger(trigger, {
      parent,
      getContent: () => sub,
      isOpen: () => open,
      setOpen: (next, intent) => {
        setOpen(next);
        if (next) child.focusEntry(intent);
      },
      dir: "ltr",
    });
    trigger.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(open).toBe(true);
    expect(document.activeElement?.id).toBe("deep");
    await userEvent.keyboard("{ArrowLeft}");
    expect(open).toBe(false);
    expect(document.activeElement?.id).toBe("sub");
  });

  it("opens on hover after a delay and keeps it through the grace area", async () => {
    const host = mount(SUB);
    (host.querySelector("#menu") as HTMLElement).style.width = "150px";
    const sub = host.querySelector("#submenu") as HTMLElement;
    sub.style.cssText = "position:fixed;left:300px;top:0;width:100px;height:200px";
    sub.setAttribute("data-side", "right");
    const trigger = host.querySelector("#sub") as HTMLElement;
    const parent = createMenuContent(host.querySelector("#menu") as HTMLElement);
    let open = false;
    bindSubmenuTrigger(trigger, {
      parent,
      getContent: () => sub,
      isOpen: () => open,
      setOpen: (next) => {
        open = next;
      },
      openDelay: 20,
    });
    const rect = trigger.getBoundingClientRect();
    const fire = (type: string, x: number, y: number, target: Element = trigger) =>
      target.dispatchEvent(
        new PointerEvent(type, { pointerType: "mouse", clientX: x, clientY: y, bubbles: true }),
      );
    fire("pointermove", rect.left + 5, rect.top + 5);
    await tick(50);
    expect(open).toBe(true);
    // Leave toward the submenu: the triangle covers the way there.
    fire("pointerleave", rect.right, rect.top + 5);
    parent.element.dispatchEvent(
      new PointerEvent("pointermove", { pointerType: "mouse", clientX: 10, bubbles: true }),
    );
    parent.element.dispatchEvent(
      new PointerEvent("pointermove", { pointerType: "mouse", clientX: 40, bubbles: true }),
    );
    expect(parent.isMovingToSubmenu({ x: 310, y: 50 })).toBe(true);
    expect(parent.isMovingToSubmenu({ x: 20, y: 500 })).toBe(false);
  });

  it("arms the grace area on pointerout, before the parent refocuses itself on leaving an item", async () => {
    const host = mount(SUB);
    (host.querySelector("#menu") as HTMLElement).style.width = "150px";
    const sub = host.querySelector("#submenu") as HTMLElement;
    sub.style.cssText = "position:fixed;left:300px;top:0;width:100px;height:200px";
    sub.setAttribute("data-side", "right");
    const trigger = host.querySelector("#sub") as HTMLElement;
    const menu = host.querySelector("#menu") as HTMLElement;
    const parent = createMenuContent(menu);
    bindSubmenuTrigger(trigger, {
      parent,
      getContent: () => sub,
      isOpen: () => true,
      setOpen: () => {},
    });
    trigger.focus();
    const rect = trigger.getBoundingClientRect();
    // pointerout reaches the trigger's listener first, then the content's (which refocuses it).
    trigger.dispatchEvent(
      new PointerEvent("pointerout", {
        pointerType: "mouse",
        clientX: rect.right,
        clientY: rect.top + 5,
        relatedTarget: sub,
        bubbles: true,
      }),
    );
    expect(document.activeElement).toBe(trigger);
  });
});
