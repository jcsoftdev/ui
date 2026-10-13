import { afterEach, describe, expect, it } from "vitest";
import {
  blockOutsidePointerEvents,
  hideOthers,
  isPointerEventsBlocked,
} from "../src/hide-others.ts";
import { createPresence, exitDuration } from "../src/presence.ts";
import { lockScroll } from "../src/scroll-lock.ts";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style[data-t]").forEach((node) => {
    node.remove();
  });
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("presence", () => {
  const style = (css: string) => {
    const node = document.createElement("style");
    node.dataset.t = "";
    node.textContent = css;
    document.head.append(node);
  };

  it("keeps the node mounted through its exit transition, ignoring colour transitions", async () => {
    style(".fade{opacity:0;transition:opacity 80ms} .tint{transition:color 5s}");
    document.body.innerHTML = '<div class="fade" id="a"></div><div class="tint" id="b"></div>';
    const a = document.querySelector<HTMLElement>("#a")!;
    expect(exitDuration(a)).toBe(80);
    expect(exitDuration(document.querySelector("#b")!)).toBe(0);
    const changes: boolean[] = [];
    const presence = createPresence({
      node: () => a,
      onChange: (m) => changes.push(m),
      initial: true,
    });
    presence.present(false);
    expect(presence.mounted()).toBe(true);
    await wait(250);
    expect(changes).toEqual([false]);
    presence.present(true);
    presence.present(false);
    presence.present(true);
    await wait(250);
    expect(presence.mounted()).toBe(true);
  });

  it("unmounts at once without motion", () => {
    document.body.innerHTML = '<div id="a"></div>';
    const presence = createPresence({
      node: () => document.querySelector("#a") as HTMLElement,
      onChange: () => {},
      initial: true,
    });
    presence.present(false);
    expect(presence.mounted()).toBe(false);
  });
});

describe("scroll lock", () => {
  it("is ref-counted and restores overflow, padding and the marker", () => {
    document.body.style.overflow = "scroll";
    const a = lockScroll();
    const b = lockScroll();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
    a();
    a();
    expect(document.body.style.overflow).toBe("hidden");
    b();
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    document.body.style.overflow = "";
  });
});

describe("hideOthers", () => {
  it("hides siblings on the path, spares live regions, and the top call wins", () => {
    document.body.innerHTML = `
      <main id="app"><p id="p">page</p></main>
      <div id="live" aria-live="polite"></div>
      <div id="a"><div id="keepA"></div><span id="sibA"></span></div>
      <div id="b"></div>`;
    const $ = (id: string) => document.getElementById(id)!;
    const releaseA = hideOthers([$("keepA")]);
    expect($("app").inert).toBe(true);
    expect($("app").getAttribute("aria-hidden")).toBe("true");
    expect($("sibA").inert).toBe(true);
    expect($("live").inert).toBe(false);
    expect($("keepA").inert).toBe(false);
    const releaseB = hideOthers([$("b")]);
    expect($("app").inert).toBe(true);
    expect($("a").inert).toBe(true);
    releaseA();
    expect($("a").inert).toBe(true);
    releaseB();
    for (const id of ["app", "a", "sibA", "b"]) {
      expect($(id).inert).toBe(false);
      expect($(id).hasAttribute("aria-hidden")).toBe(false);
    }
  });

  it("leaves elements hidden by someone else untouched", () => {
    document.body.innerHTML = '<div id="x" aria-hidden="true" inert></div><div id="k"></div>';
    const release = hideOthers([document.getElementById("k")]);
    release();
    expect(document.getElementById("x")!.inert).toBe(true);
    expect(document.getElementById("x")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("pointer lock", () => {
  it("is ref-counted", () => {
    const a = blockOutsidePointerEvents();
    const b = blockOutsidePointerEvents();
    expect(document.body.style.pointerEvents).toBe("none");
    expect(isPointerEventsBlocked()).toBe(true);
    a();
    expect(isPointerEventsBlocked()).toBe(true);
    b();
    expect(isPointerEventsBlocked()).toBe(false);
    expect(document.body.style.pointerEvents).toBe("");
  });
});
