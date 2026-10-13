"use client";

import { useEffect } from "react";
import { supportsBackdropRefraction } from "./support.js";

/** The surfaces whose CSS can resolve to a lensed liquid material (`--glass-lens: 1`). */
const SURFACES =
  ".glass, .glass-clear, .liquid, .liquid-clear, .surface-overlay, .surface-nav, .surface-side";
/** Preferences that flip the `--glass-lens` flag in CSS; the lens is brought back when cleared. */
const PREFERENCES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
  "(prefers-reduced-motion: reduce)",
];
/** Attributes that can change whether a surface or its subtree resolves to a lensed liquid material. */
const WATCHED = ["class", "data-glass", "data-glass-lens", "data-style", "data-theme"];

let users = 0;
let stopAll: (() => void) | undefined;

function watch(): () => void {
  const root = document.documentElement;
  const lensed = new Map<HTMLElement, () => void>();
  let engine: typeof import("./refraction.js") | undefined;
  let loading = false;
  const dirty = new Set<Element>();
  let prune = false;
  let frame = 0;

  const wants = (element: HTMLElement) =>
    element.isConnected &&
    !element.closest('[data-glass-lens="off"]') &&
    getComputedStyle(element).getPropertyValue("--glass-lens").trim() === "1";

  const check = (element: HTMLElement) => {
    const stop = lensed.get(element);
    if (!wants(element)) {
      stop?.();
      lensed.delete(element);
    } else if (!stop && engine) {
      // The pointer mode of an automatic lens is the surface's own (its `style` or
      // `data-glass-interactive`): a scope above it never makes it pressable or draggable.
      lensed.set(
        element,
        engine.applyGlassRefraction(element, { auto: true, ownInteractive: true }),
      );
    } else if (!stop && !loading) {
      // The engine is its own chunk, fetched the first time a surface resolves to a lensed liquid.
      loading = true;
      import("./refraction.js").then((module) => {
        engine = module;
        if (frame >= 0) queue(root);
      });
    }
  };

  const scan = (node: Element) => {
    if (node.matches(SURFACES)) check(node as HTMLElement);
    for (const element of node.querySelectorAll<HTMLElement>(SURFACES)) check(element);
  };

  const flush = () => {
    frame = 0;
    if (prune)
      for (const [element, stop] of lensed)
        if (!element.isConnected) {
          stop();
          lensed.delete(element);
        }
    prune = false;
    const batch = [...dirty];
    dirty.clear();
    for (const node of batch) if (node.isConnected) scan(node);
  };

  function queue(node: Element) {
    dirty.add(node);
    if (!frame) frame = requestAnimationFrame(flush);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") queue(record.target as Element);
      else {
        if (record.removedNodes.length) prune = true;
        for (const node of record.addedNodes) if (node instanceof Element) queue(node);
      }
    }
    if (prune && !frame) frame = requestAnimationFrame(flush);
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: WATCHED,
  });
  const recheck = () => queue(root);
  const lists = PREFERENCES.map((query) => matchMedia(query));
  for (const list of lists) list.addEventListener("change", recheck);
  queue(root);

  return () => {
    observer.disconnect();
    for (const list of lists) list.removeEventListener("change", recheck);
    if (frame) cancelAnimationFrame(frame);
    frame = -1;
    for (const stop of lensed.values()) stop();
    lensed.clear();
  };
}

/**
 * Turns the Liquid Glass lens on for the page. Every surface whose CSS resolves to a lensed liquid
 * material (`--glass-lens: 1`: `liquid`, `liquid-clear`, and the glass and chrome surfaces under
 * `data-glass="liquid"`) gets the refraction engine, which is a lazy chunk fetched the first time
 * one does; the crystal and dispersion parts are further chunks, fetched only for surfaces that use
 * them. The decision follows the page: classes, `data-glass`, `data-glass-lens`, `data-style` and
 * `data-theme` anywhere in the document, added and removed surfaces, and the transparency,
 * contrast and motion preferences. `data-glass-lens="off"` on a surface or an ancestor, or
 * `--glass-lens: 0`, keeps the plain liquid look. Where the engine cannot paint (see
 * {@link supportsBackdropRefraction}) it does nothing and loads nothing.
 *
 * Calls are counted: the page is watched until every returned stop has run. Without it, liquid
 * surfaces keep the CSS look (rim, depth, blur) and no lens code is loaded at all.
 */
export function startLiquidGlass(): () => void {
  if (
    typeof document === "undefined" ||
    typeof MutationObserver !== "function" ||
    typeof matchMedia !== "function" ||
    !supportsBackdropRefraction()
  )
    return () => {};
  users++;
  stopAll ??= watch();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--users === 0) {
      stopAll?.();
      stopAll = undefined;
    }
  };
}

/**
 * {@link startLiquidGlass} as a component: render it once, near the root, in an app that uses Liquid
 * Glass. It renders nothing; it is the only thing that pulls the lens code into a bundle.
 */
export function LiquidGlass(): null {
  useEffect(() => startLiquidGlass(), []);
  return null;
}
