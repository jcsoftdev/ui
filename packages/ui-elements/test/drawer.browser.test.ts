import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDialog, type UiDialog } from "../src/dialog/dialog.ts";
import { defineDrawer, type UiDrawer } from "../src/drawer/drawer.ts";
import { definePopover, type UiPopover } from "../src/popover/popover.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineDrawer();
  defineDialog();
  definePopover();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.body.style.overflow = "";
});

const DRAWER = `<button id="opener" commandfor="d" command="--open">Open</button>
  <ui-drawer id="d">
    <div data-drawer-header><h2 data-drawer-title>Filters</h2></div>
    <div data-drawer-body><p data-drawer-description>Narrow the list.</p>
      <input id="field" aria-label="Search"></div>
    <div data-drawer-footer><button data-drawer-close id="done">Done</button></div>
  </ui-drawer>`;

/** Dispatches a touch drag on `target` from `from` by `by` px, in a few moves. */
async function swipe(target: Element, from: [number, number], by: [number, number], pace = 8) {
  const init = (x: number, y: number) => ({
    bubbles: true,
    composed: true,
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(new PointerEvent("pointerdown", init(...from)));
  for (const step of [0.25, 0.5, 0.75, 1]) {
    target.dispatchEvent(
      new PointerEvent("pointermove", init(from[0] + by[0] * step, from[1] + by[1] * step)),
    );
    await wait(pace);
  }
  target.dispatchEvent(new PointerEvent("pointerup", init(from[0] + by[0], from[1] + by[1])));
}

describe("ui-drawer", () => {
  it("opens modally from an invoker, is named and described, locks scroll, closes on Escape and returns focus", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    const opened = vi.fn();
    const closed = vi.fn();
    drawer.addEventListener("open", opened);
    drawer.addEventListener("close", closed);
    await userEvent.click(host.querySelector("#opener")!);
    expect(drawer.open).toBe(true);
    expect(drawer.panel?.matches(":modal")).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(await ax("dialog", "Filters")).toBeTruthy();
    expect(drawer.panel?.getAttribute("aria-describedby")).toBe(
      host.querySelector("[data-drawer-description]")!.id,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(drawer.panel?.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(drawer.open).toBe(false);
    // `close` fires once the slide-out ended and focus is back.
    await vi.waitFor(() => expect(drawer.panel?.open).toBe(false));
    expect(closed).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement?.id).toBe("opener");
  });

  it("contains focus: Tab never reaches the page behind", async () => {
    const host = mount(`${DRAWER}<button id="outside">Outside</button>`);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.show();
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(document.activeElement?.id).not.toBe("outside");
    }
    expect(host.querySelector("#outside")?.matches(":focus")).toBe(false);
    expect(drawer.panel?.matches(":modal")).toBe(true);
  });

  it("sits on the edge its side names and slides to it when closed", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    const edges: Record<string, (box: DOMRect) => boolean> = {
      right: (box) => Math.round(box.right) === innerWidth && box.height === innerHeight,
      left: (box) => box.left === 0 && box.height === innerHeight,
      top: (box) => box.top === 0 && Math.round(box.width) === innerWidth,
      bottom: (box) =>
        Math.round(box.bottom) === innerHeight && Math.round(box.width) === innerWidth,
    };
    for (const [side, onEdge] of Object.entries(edges)) {
      drawer.setAttribute("side", side);
      drawer.show();
      await wait(260);
      expect(onEdge(drawer.panel!.getBoundingClientRect()), side).toBe(true);
      drawer.close();
      await vi.waitFor(() => expect(drawer.panel?.open).toBe(false));
    }
  });

  it("blocking ignores Escape and the backdrop; cancel can veto a close", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.setAttribute("blocking", "");
    drawer.show();
    expect(drawer.querySelector("[data-ui-part=close]")).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.body, { position: { x: 5, y: 5 } });
    expect(drawer.open).toBe(true);
    drawer.removeAttribute("blocking");
    const veto = (event: Event) => event.preventDefault();
    drawer.addEventListener("cancel", veto);
    await userEvent.keyboard("{Escape}");
    expect(drawer.open).toBe(true);
    drawer.removeEventListener("cancel", veto);
    await userEvent.click(drawer.querySelector("[data-ui-part=close]")!);
    expect(drawer.open).toBe(false);
  });

  it("swipes away toward its edge from the grabber, and springs back when released early", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.show();
    await wait(260);
    const handle = drawer.querySelector("[data-ui-part=handle]")!;
    const box = drawer.panel!.getBoundingClientRect();
    // The swipe loads lazily on first open; a short pull then releases back.
    await vi.waitFor(async () => {
      await swipe(handle, [box.left + 5, 200], [40, 0], 60);
      expect(drawer.open).toBe(true);
      expect(drawer.panel?.style.translate).toBe("");
    });
    await swipe(handle, [box.left + 5, 200], [box.width * 0.6, 0]);
    expect(drawer.open).toBe(false);
    await vi.waitFor(() => expect(drawer.panel?.open).toBe(false));
  });

  it("swipes only from the grabber or header, never from a control or the body", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.show();
    await wait(260);
    const box = drawer.panel!.getBoundingClientRect();
    await wait(50);
    await swipe(host.querySelector("#field")!, [box.left + 50, 300], [box.width, 0]);
    await swipe(host.querySelector("[data-drawer-body]")!, [box.left + 50, 300], [box.width, 0]);
    expect(drawer.open).toBe(true);
    drawer.setAttribute("swipe", "off");
    expect(drawer.querySelector<HTMLElement>("[data-ui-part=handle]")!.hidden).toBe(true);
  });

  it("closes one layer per Escape: a popover inside it first, then the drawer", async () => {
    const host = mount(`<ui-drawer id="d">
        <div data-drawer-body><button id="t" popovertarget="p">Menu</button>
          <ui-popover id="p"><button id="item">Item</button></ui-popover></div>
      </ui-drawer>`);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    const popover = host.querySelector<UiPopover>("ui-popover")!;
    drawer.show();
    await userEvent.click(host.querySelector("#t")!);
    await expect.poll(() => popover.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popover.open).toBe(false);
    expect(drawer.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => drawer.open).toBe(false);
  });

  it("stacks inside a dialog: Escape closes the drawer, then the dialog", async () => {
    const host = mount(`<ui-dialog id="dlg">
        <div data-dialog-body><button id="open-drawer" commandfor="d" command="--open">Filters</button>
          <ui-drawer id="d"><div data-drawer-body><input aria-label="Name"></div></ui-drawer></div>
      </ui-dialog>`);
    const dialog = host.querySelector<UiDialog>("ui-dialog")!;
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    dialog.show();
    await userEvent.click(host.querySelector("#open-drawer")!);
    expect(drawer.open).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(drawer.open).toBe(false);
    expect(dialog.open).toBe(true);
    await vi.waitFor(() =>
      expect(host.querySelector("#open-drawer")?.matches(":focus")).toBe(true),
    );
    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("reopening during the exit slide keeps one scroll lock and the original opener", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    (host.querySelector("#opener") as HTMLElement).focus();
    drawer.show();
    await wait(260);
    drawer.close();
    drawer.show();
    await wait(260);
    expect(drawer.panel?.open).toBe(true);
    drawer.close();
    await vi.waitFor(() => expect(drawer.panel?.open).toBe(false));
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement?.id).toBe("opener");
  });

  it("ignores jitter and stale or tiny flicks, but a real fast flick still dismisses", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.show();
    await wait(260);
    const handle = drawer.querySelector("[data-ui-part=handle]")!;
    const box = drawer.panel!.getBoundingClientRect();
    const x = box.left + 5;
    await wait(50);
    // 4 px of jitter: under the slop, nothing moves, nothing closes.
    await swipe(handle, [x, 200], [4, 0], 5);
    expect(drawer.open).toBe(true);
    expect(drawer.panel?.hasAttribute("data-dragging")).toBe(false);
    // A fast but tiny move (8 px in 10 ms): below the minimum offset for a flick.
    await swipe(handle, [x, 200], [8, 0], 2);
    expect(drawer.open).toBe(true);
    // A fast flick that then rests before release: the velocity is stale.
    const init = (cx: number) => ({
      bubbles: true,
      composed: true,
      pointerId: 8,
      pointerType: "touch",
      isPrimary: true,
      clientX: cx,
      clientY: 200,
    });
    handle.dispatchEvent(new PointerEvent("pointerdown", init(x)));
    for (const dx of [10, 25, 40]) {
      handle.dispatchEvent(new PointerEvent("pointermove", init(x + dx)));
      await wait(4);
    }
    await wait(200);
    handle.dispatchEvent(new PointerEvent("pointerup", init(x + 40)));
    expect(drawer.open).toBe(true);
    // A genuine flick: 60 px in ~15 ms.
    await swipe(handle, [x, 200], [60, 0], 4);
    expect(drawer.open).toBe(false);
  });

  it("keeps clicks on header controls, including ARIA-role controls", async () => {
    const host = mount(`<ui-drawer id="d">
        <div data-drawer-header><h2 data-drawer-title>Title</h2>
          <button id="hb">Native</button><span id="rb" role="button" tabindex="0">Role</span></div>
        <div data-drawer-body>Body</div></ui-drawer>`);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.show();
    await wait(260);
    const clicks: string[] = [];
    for (const id of ["hb", "rb"])
      host.querySelector(`#${id}`)!.addEventListener("click", () => clicks.push(id));
    await wait(50);
    await userEvent.click(host.querySelector("#hb")!);
    await userEvent.click(host.querySelector("#rb")!);
    // A plain click on the header text must not capture the pointer either.
    await userEvent.click(host.querySelector("[data-drawer-title]")!);
    expect(clicks).toEqual(["hb", "rb"]);
    expect(drawer.open).toBe(true);
  });

  it("blocking hides the grabber and cannot be swiped", async () => {
    const host = mount(DRAWER);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    drawer.setAttribute("blocking", "");
    drawer.show();
    await wait(260);
    const handle = drawer.querySelector<HTMLElement>("[data-ui-part=handle]")!;
    expect(handle.hidden).toBe(true);
    await wait(50);
    await swipe(drawer.querySelector("[data-drawer-header]")!, [innerWidth - 100, 30], [400, 0]);
    expect(drawer.open).toBe(true);
  });

  it("is inert while it slides out, so Escape and focus do nothing, and a close handler's focus sticks", async () => {
    const host = mount(`${DRAWER}<button id="other">Other</button>`);
    const drawer = host.querySelector<UiDrawer>("ui-drawer")!;
    const cancel = vi.fn();
    drawer.addEventListener("cancel", cancel);
    (host.querySelector("#opener") as HTMLElement).focus();
    drawer.show();
    await wait(260);
    drawer.addEventListener("close", () => host.querySelector<HTMLElement>("#other")!.focus());
    drawer.close();
    expect(drawer.panel?.inert).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(cancel).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(drawer.panel?.open).toBe(false));
    expect(drawer.panel?.inert).toBe(false);
    expect(document.activeElement?.id).toBe("other");
  });

  it("registers under a custom prefix", () => {
    expect(defineDrawer({ prefix: "acme" })).toBe("acme-drawer");
  });
});
