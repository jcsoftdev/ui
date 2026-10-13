import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createDismissLayer } from "../src/dismiss.ts";
import { createFocusScope } from "../src/focus.ts";
import { autoPosition } from "../src/popper.ts";
import { createRovingFocus } from "../src/roving.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createFocusScope", () => {
  it("moves focus in, traps Tab both ways and returns focus on release", async () => {
    const host = mount(`
      <button id="opener">open</button>
      <div id="scope"><a href="#x">link</a><button id="a">a</button><button id="b">b</button></div>
      <button id="after">after</button>`);
    const opener = host.querySelector<HTMLElement>("#opener")!;
    opener.focus();
    const release = createFocusScope(host.querySelector("#scope")!);
    // Links are skipped for the initial focus.
    expect(document.activeElement?.id).toBe("a");
    await userEvent.tab();
    expect(document.activeElement?.id).toBe("b");
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("link");
    await userEvent.tab({ shift: true });
    expect(document.activeElement?.id).toBe("b");
    release();
    expect(document.activeElement).toBe(opener);
  });

  it("pulls back focus that lands outside while trapped", async () => {
    const host = mount(
      `<div id="scope"><button id="a">a</button></div><button id="out">out</button>`,
    );
    const release = createFocusScope(host.querySelector("#scope")!);
    host.querySelector<HTMLElement>("#out")!.focus();
    expect(document.activeElement?.id).toBe("a");
    release();
  });
});

describe("createDismissLayer", () => {
  it("dismisses the top layer only, on Escape and on an outside press", async () => {
    const host = mount(
      `<div id="lower">lower</div><div id="upper">upper</div><p id="page">page</p>`,
    );
    const lower = vi.fn();
    const upper = vi.fn();
    const stopLower = createDismissLayer(host.querySelector("#lower")!, { onDismiss: lower });
    const stopUpper = createDismissLayer(host.querySelector("#upper")!, { onDismiss: upper });
    await tick();
    await userEvent.keyboard("{Escape}");
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    stopUpper();
    await userEvent.click(host.querySelector("#page")!);
    expect(lower).toHaveBeenCalledTimes(1);
    stopLower();
  });

  it("keeps the layer open when a handler prevents it and ignores inside presses", async () => {
    const host = mount(
      `<div id="layer"><button id="in">in</button></div><button id="trigger">t</button>`,
    );
    const dismiss = vi.fn();
    const stop = createDismissLayer(host.querySelector("#layer")!, {
      onDismiss: dismiss,
      inside: () => [host.querySelector("#trigger")],
      onEscapeKeyDown: (event) => event.preventDefault(),
    });
    await tick();
    await userEvent.click(host.querySelector("#in")!);
    await userEvent.click(host.querySelector("#trigger")!);
    await userEvent.keyboard("{Escape}");
    expect(dismiss).not.toHaveBeenCalled();
    stop();
  });
});

describe("createRovingFocus", () => {
  it("keeps one tab stop, skips disabled items and follows arrows", async () => {
    const host = mount(`<div id="root">
      <button data-roving-item>a</button><button data-roving-item disabled>b</button>
      <button data-roving-item>c</button></div>`);
    const root = host.querySelector<HTMLElement>("#root")!;
    const navigate = vi.fn();
    const roving = createRovingFocus(root, { orientation: "horizontal", onNavigate: navigate });
    const [a, , c] = root.querySelectorAll("button");
    expect([...root.querySelectorAll("button")].map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    a!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(c);
    expect(c!.tabIndex).toBe(0);
    expect(a!.tabIndex).toBe(-1);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(a);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(a);
    expect(navigate).toHaveBeenCalledTimes(2);
    roving.destroy();
  });
});

describe("autoPosition", () => {
  it("places under the anchor and flips above near the bottom edge", async () => {
    const host =
      mount(`<button id="anchor" style="position:fixed;left:100px;top:100px;width:40px;height:20px">a</button>
      <div id="float" style="width:120px;height:60px"><span id="arrow"></span></div>`);
    const anchor = host.querySelector<HTMLElement>("#anchor")!;
    const floating = host.querySelector<HTMLElement>("#float")!;
    const stop = autoPosition(anchor, floating, {
      side: "bottom",
      sideOffset: 4,
      arrow: host.querySelector<HTMLElement>("#arrow"),
    });
    let box = floating.getBoundingClientRect();
    expect(floating.dataset.side).toBe("bottom");
    expect(Math.round(box.top)).toBe(129);
    expect(Math.round(box.left)).toBe(60);
    anchor.style.top = `${window.innerHeight - 30}px`;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    box = floating.getBoundingClientRect();
    expect(floating.dataset.side).toBe("top");
    expect(Math.round(box.bottom)).toBe(window.innerHeight - 30 - 9);
    stop();
  });
});
