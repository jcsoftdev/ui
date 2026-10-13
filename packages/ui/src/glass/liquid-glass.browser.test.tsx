/// <reference types="@vitest/browser-playwright" />
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import "../../test/glass-browser.css";
import { LiquidGlass, setLiquidEngineLoader, startLiquidGlass } from "./liquid-glass.js";
import { applyGlassRefraction } from "./refraction.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const filters = () => document.querySelectorAll("#ui-glass-refraction-defs filter").length;
const scales = () =>
  [...document.querySelectorAll("#ui-glass-refraction-defs feDisplacementMap")].map((node) =>
    node.getAttribute("scale"),
  );
const settle = () => new Promise((r) => setTimeout(r, 150));

let stops: Array<() => void> = [];
let root: Root | undefined;
let host: HTMLElement | undefined;

/** A plain sized element with the given classes, inside a fresh host. */
function surface(className = "liquid", style = "") {
  host ??= document.body.appendChild(document.createElement("div"));
  const element = document.createElement("div");
  element.className = className;
  element.style.cssText = `position:absolute;top:8px;left:8px;width:160px;height:96px;${style}`;
  host.appendChild(element);
  return element;
}

afterEach(async () => {
  for (const stop of stops) stop();
  stops = [];
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  setLiquidEngineLoader();
  await vi.waitFor(() => expect(filters()).toBe(0));
});

describe("<LiquidGlass /> and startLiquidGlass()", () => {
  test("rendering <LiquidGlass /> lenses a liquid element and unmounting releases it", async () => {
    const element = surface();
    host = element.parentElement as HTMLElement;
    const mountPoint = host.appendChild(document.createElement("div"));
    root = createRoot(mountPoint);
    await act(async () => root?.render(<LiquidGlass />));
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
    await act(async () => root?.render(null));
    await vi.waitFor(() => expect(filters()).toBe(0));
    expect(element.dataset.glassRefraction).toBeUndefined();
  });

  test("StrictMode's double effect leaves one lens, released on unmount", async () => {
    const element = surface();
    const mountPoint = (host as HTMLElement).appendChild(document.createElement("div"));
    root = createRoot(mountPoint);
    await act(async () =>
      root?.render(
        <StrictMode>
          <LiquidGlass />
          <LiquidGlass />
        </StrictMode>,
      ),
    );
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
    await settle();
    expect(filters()).toBe(1);
    await act(async () => root?.render(null));
    await vi.waitFor(() => expect(filters()).toBe(0));
  });

  test("calls are counted: the page is watched until the last stop, and can start again", async () => {
    const element = surface();
    const a = startLiquidGlass();
    const b = startLiquidGlass();
    await vi.waitFor(() => expect(filters()).toBe(1));
    a();
    a(); // a second call of the same stop does not count twice
    await settle();
    expect(element.dataset.glassRefraction).toBe("on");
    b();
    await vi.waitFor(() => expect(filters()).toBe(0));
    stops.push(startLiquidGlass());
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
  });

  test("a failed engine chunk is retried with a backoff, without an unhandled rejection", async () => {
    let calls = 0;
    setLiquidEngineLoader(() =>
      calls++ === 0 ? Promise.reject(new Error("offline")) : import("./refraction.js"),
    );
    const element = surface();
    stops.push(startLiquidGlass());
    await settle();
    expect(calls).toBe(1);
    expect(element.dataset.glassRefraction).toBeUndefined();
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"), { timeout: 3000 });
    expect(calls).toBe(2);
  });
});

describe("the watcher decides from the computed flag", () => {
  test("a md:liquid surface is lensed only above the breakpoint", async () => {
    await page.viewport(600, 500);
    const element = surface("md:liquid");
    stops.push(startLiquidGlass());
    await settle();
    expect(element.dataset.glassRefraction).toBeUndefined();
    await page.viewport(1000, 500);
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
    await page.viewport(600, 500);
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBeUndefined());
  });

  test("an inline --glass-lens toggles the lens", async () => {
    const element = surface("liquid", "--glass-lens:0");
    stops.push(startLiquidGlass());
    await settle();
    expect(element.dataset.glassRefraction).toBeUndefined();
    element.style.removeProperty("--glass-lens");
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
  });
});

describe("slots go to surfaces that can show a lens", () => {
  test("hidden and zero-area surfaces take no slot, and lens once they show", async () => {
    const hidden = surface("liquid", "display:none");
    const empty = surface("liquid", "width:0");
    const visible = Array.from({ length: 8 }, (_, i) =>
      surface("liquid", `top:${8 + i * 10}px;width:40px;height:8px`),
    );
    stops.push(startLiquidGlass());
    await vi.waitFor(() => expect(filters()).toBe(8));
    for (const element of visible) expect(element.dataset.glassRefraction).toBe("on");
    expect(hidden.dataset.glassRefraction).toBeUndefined();
    expect(empty.dataset.glassRefraction).toBeUndefined();
    visible[0]?.remove();
    hidden.style.display = "block";
    await vi.waitFor(() => expect(hidden.dataset.glassRefraction).toBe("on"));
  });

  test("a surface far outside the viewport gives its slot to visible ones", async () => {
    const far = surface("liquid", "top:20000px");
    const visible = Array.from({ length: 8 }, (_, i) =>
      surface("liquid", `top:${8 + i * 10}px;width:40px;height:8px`),
    );
    stops.push(startLiquidGlass());
    await vi.waitFor(() => {
      for (const element of visible) expect(element.dataset.glassRefraction).toBe("on");
    });
    expect(far.dataset.glassRefraction).toBeUndefined();
    expect(filters()).toBe(8);
  });
});

describe("a lens applied by code and the watcher share one element", () => {
  test("manual first: the watcher neither replaces its options nor stops it", async () => {
    const element = surface();
    const manual = applyGlassRefraction(element, { scale: 33, animate: false });
    await vi.waitFor(() => expect(scales()).toEqual(["33"]));
    const watcher = startLiquidGlass();
    await settle();
    expect(scales()).toEqual(["33"]);
    watcher();
    await settle();
    expect(scales()).toEqual(["33"]);
    manual();
    await vi.waitFor(() => expect(filters()).toBe(0));
  });

  test("auto first: manual options win, and its cleanup hands the lens back to the watcher", async () => {
    const element = surface();
    stops.push(startLiquidGlass());
    await vi.waitFor(() => expect(element.dataset.glassRefraction).toBe("on"));
    const manual = applyGlassRefraction(element, { scale: 33, animate: false });
    await vi.waitFor(() => expect(scales()).toEqual(["33"]));
    manual();
    await settle();
    expect(filters()).toBe(1);
    expect(element.dataset.glassRefraction).toBe("on");
    expect(scales()).not.toEqual(["33"]);
    // A stale cleanup from the ended claim does not touch the watcher's lens.
    manual();
    await settle();
    expect(filters()).toBe(1);
    // A new manual claim after the old one ended works and is undone by its own cleanup only.
    const again = applyGlassRefraction(element, { scale: 21, animate: false });
    await vi.waitFor(() => expect(scales()).toEqual(["21"]));
    manual();
    await settle();
    expect(scales()).toEqual(["21"]);
    again();
    await vi.waitFor(() => expect(scales()).not.toEqual(["21"]));
    expect(filters()).toBe(1);
  });
});
