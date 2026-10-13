import { afterEach, describe, expect, it, vi } from "vitest";
import { createCopier } from "../src/clipboard.ts";
import { consumeContext, createContextKey, provideContext } from "../src/context.ts";
import { isOnline, observeOnline } from "../src/observe/online.ts";
import { createScrollSpy } from "../src/observe/scroll-spy.ts";
import { createStickToBottom } from "../src/observe/stick-to-bottom.ts";

const frame = () => new Promise((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scroll-spy", () => {
  it("activates the heading in the top band as the container scrolls", async () => {
    document.body.innerHTML = `<div id="s" style="height:200px;overflow:auto">
      <h2 id="a" style="height:400px;margin:0">A</h2><h2 id="b" style="height:400px;margin:0">B</h2>
      <h2 id="c" style="height:400px;margin:0">C</h2></div>`;
    const root = document.getElementById("s") as HTMLElement;
    const seen: Array<string | null> = [];
    const spy = createScrollSpy({ ids: ["a", "b", "c"], root, onChange: (id) => seen.push(id) });
    await frame();
    root.scrollTop = 410;
    await frame();
    expect(spy.active).toBe("b");
    expect(seen).toContain("b");
    spy.destroy();
  });
});

describe("stick-to-bottom", () => {
  it("follows growth while stuck and releases when the reader scrolls up", async () => {
    document.body.innerHTML = `<div id="s" style="height:100px;overflow:auto"><div id="c"></div></div>`;
    const scroller = document.getElementById("s") as HTMLElement;
    const content = document.getElementById("c") as HTMLElement;
    const jumps: boolean[] = [];
    const stick = createStickToBottom({ scroller, content, onJumpChange: (v) => jumps.push(v) });
    content.style.height = "500px";
    await frame();
    expect(scroller.scrollTop).toBe(400);
    scroller.scrollTop = 100;
    await frame();
    expect(stick.stuck).toBe(false);
    content.style.height = "700px";
    await frame();
    expect(scroller.scrollTop).toBe(100);
    expect(jumps.at(-1)).toBe(true);
    stick.jump();
    await frame();
    expect(scroller.scrollTop).toBe(600);
    expect(jumps.at(-1)).toBe(false);
    stick.destroy();
  });

  it("releases when the reader scrolls up before the follow scroll event is delivered", async () => {
    document.body.innerHTML = `<div id="s" style="height:100px;overflow:auto"><div id="c"></div></div>`;
    const scroller = document.getElementById("s") as HTMLElement;
    const content = document.getElementById("c") as HTMLElement;
    const stick = createStickToBottom({ scroller, content });
    // Runs right after the follow-scroll in the same resize pass, before its scroll event is
    // dispatched: the browser then coalesces both moves into one event.
    const reader = new ResizeObserver(() => {
      if (scroller.scrollTop === 400) scroller.scrollTop = 100;
    });
    reader.observe(content);
    content.style.height = "500px";
    await frame();
    reader.disconnect();
    expect(scroller.scrollTop).toBe(100);
    expect(stick.stuck).toBe(false);
    stick.destroy();
  });
});

describe("online", () => {
  it("reports connectivity events", () => {
    const seen: boolean[] = [];
    const stop = observeOnline((v) => seen.push(v));
    dispatchEvent(new Event("offline"));
    dispatchEvent(new Event("online"));
    stop();
    dispatchEvent(new Event("offline"));
    expect(seen).toEqual([false, true]);
    expect(typeof isOnline()).toBe("boolean");
  });
});

describe("clipboard", () => {
  it("flags copied for resetMs", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const states: boolean[] = [];
    const copier = createCopier((v) => states.push(v), 30);
    await copier.copy("hello");
    expect(copier.copied).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(states).toEqual([true, false]);
    vi.restoreAllMocks();
    copier.destroy();
  });

  it("rejects, and never flags copied, when both copy paths are refused", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    const states: boolean[] = [];
    const copier = createCopier((v) => states.push(v));
    await expect(copier.copy("x")).rejects.toThrow();
    expect(states).toEqual([]);
    expect(document.querySelector("textarea")).toBeNull();
    vi.restoreAllMocks();
    copier.destroy();
  });
});

describe("context", () => {
  it("crosses a shadow boundary", () => {
    const key = createContextKey<{ close: string }>("strings");
    const host = document.createElement("div");
    document.body.append(host);
    const provider = provideContext(host, key, { close: "Close" });
    const shadow = host.attachShadow({ mode: "open" });
    const child = document.createElement("span");
    shadow.append(child);
    const seen: string[] = [];
    consumeContext(child, key, (v) => seen.push(v.close));
    provider.set({ close: "Cerrar" });
    expect(seen).toEqual(["Close", "Cerrar"]);
  });
});
