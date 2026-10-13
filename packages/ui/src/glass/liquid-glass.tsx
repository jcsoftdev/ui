"use client";

import { useEffect } from "react";
import { supportsBackdropRefraction } from "./support.js";

type Engine = typeof import("./refraction.js");

/**
 * Elements that may resolve to a lensed liquid material. The decision itself is the computed
 * `--glass-lens` flag, so variants (`md:liquid`, `dark:liquid`, `liquid!`) and CSS-only toggles
 * count; a custom class built with `@apply liquid` needs `data-glass-lens="on"` to be considered.
 */
const CANDIDATES = [
  '[class*="liquid"]',
  '[class*="glass"]',
  '[class*="surface-overlay"]',
  '[class*="surface-nav"]',
  '[class*="surface-side"]',
  '[style*="--glass-lens"]',
  '[data-glass-lens="on"]',
].join(", ");
/** Preferences that flip the `--glass-lens` flag in CSS, or a `dark:` variant. */
const PREFERENCES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
  "(prefers-reduced-motion: reduce)",
  "(prefers-color-scheme: dark)",
];
/** Attributes that can change whether a surface or its subtree resolves to a lensed liquid material. */
const WATCHED = ["class", "style", "data-glass", "data-glass-lens", "data-style", "data-theme"];
/** Above this many pending subtrees, one pass over the document is cheaper than keeping them. */
const MAX_DIRTY = 64;
/** Delay before retrying a failed engine chunk, doubled per failure. */
const RETRY_MS = 500;
const RETRY_MAX_MS = 30_000;

const defaultLoader = (): Promise<Engine> => import("./refraction.js");
let loadEngine = defaultLoader;

/**
 * Test seam: replaces how the engine chunk is fetched (`undefined` restores it). Not part of the
 * public entries.
 */
export function setLiquidEngineLoader(loader?: () => Promise<Engine>): void {
  loadEngine = loader ?? defaultLoader;
}

let users = 0;
let stopAll: (() => void) | undefined;

function watch(): () => void {
  const root = document.documentElement;
  /** Surfaces this watcher holds an automatic lens claim on, with the release of that claim. */
  const lensed = new Map<HTMLElement, () => void>();
  let engine: Engine | undefined;
  let loading = false;
  let failures = 0;
  let retryAt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Subtrees to rescan, and single elements to recheck (a resize does not need their subtree). */
  const dirty = new Set<Element>();
  const self = new Set<HTMLElement>();
  /** Candidates under the size observer, kept so removed ones can be unobserved. */
  const sized = new Set<HTMLElement>();
  /** The inline `--glass-lens` last seen per element, so other inline style writes are ignored. */
  const inlineFlag = new WeakMap<Element, string>();
  let frame = 0;
  let closed = false;

  const release = (element: HTMLElement) => {
    lensed.get(element)?.();
    lensed.delete(element);
  };

  const wants = (element: HTMLElement) =>
    element.isConnected &&
    !element.closest('[data-glass-lens="off"]') &&
    getComputedStyle(element).getPropertyValue("--glass-lens").trim() === "1";

  const load = () => {
    if (loading || Date.now() < retryAt) return;
    loading = true;
    // The engine is its own chunk, fetched the first time a surface resolves to a lensed liquid.
    loadEngine().then(
      (module) => {
        engine = module;
        failures = 0;
        if (!closed) queue(root);
      },
      () => {
        loading = false;
        if (closed) return;
        const delay = Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** failures++);
        retryAt = Date.now() + delay;
        retry = setTimeout(() => queue(root), delay);
      },
    );
  };

  const check = (element: HTMLElement) => {
    inlineFlag.set(element, element.style.getPropertyValue("--glass-lens"));
    if (!sized.has(element)) {
      sized.add(element);
      sizes?.observe(element);
    }
    if (!wants(element)) release(element);
    else if (lensed.has(element)) return;
    else if (engine)
      // The pointer mode of an automatic lens is the surface's own (its `style` or
      // `data-glass-interactive`): a scope above it never makes it pressable or draggable.
      lensed.set(element, engine.claimLens(element, "auto", { auto: true, ownInteractive: true }));
    else load();
  };

  const scan = (node: Element) => {
    if (node.matches(CANDIDATES)) check(node as HTMLElement);
    for (const element of node.querySelectorAll<HTMLElement>(CANDIDATES)) check(element);
  };

  /** Lets go of surfaces that left the page, without waiting for a frame (a hidden tab has none). */
  const prune = () => {
    for (const element of [...lensed.keys()]) if (!element.isConnected) release(element);
    for (const element of sized)
      if (!element.isConnected) {
        sized.delete(element);
        sizes?.unobserve(element);
      }
    for (const node of dirty) if (!node.isConnected) dirty.delete(node);
    for (const element of self) if (!element.isConnected) self.delete(element);
  };

  const flush = () => {
    frame = 0;
    const batch = [...dirty];
    const singles = [...self];
    dirty.clear();
    self.clear();
    for (const node of batch) if (node.isConnected) scan(node);
    for (const element of singles) if (element.isConnected) check(element);
  };

  const later = () => {
    if (!frame && !closed) frame = requestAnimationFrame(flush);
  };

  function queue(node: Element) {
    if (!dirty.has(root)) {
      if (dirty.size >= MAX_DIRTY) {
        dirty.clear();
        dirty.add(root);
      } else dirty.add(node);
    }
    later();
  }

  const sizes =
    typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) => {
          // A container query or a size-dependent rule can flip the flag on this element only.
          for (const { target } of entries) self.add(target as HTMLElement);
          later();
        })
      : undefined;

  const observer = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      if (record.type === "attributes") {
        const target = record.target as HTMLElement;
        if (record.attributeName === "style") {
          // Inline styles change every frame under the motion; only the flag itself matters.
          const flag = target.style?.getPropertyValue("--glass-lens") ?? "";
          if (inlineFlag.has(target) && inlineFlag.get(target) === flag) continue;
          inlineFlag.set(target, flag);
        }
        queue(target);
      } else {
        if (record.removedNodes.length) removed = true;
        for (const node of record.addedNodes) if (node instanceof Element) queue(node);
      }
    }
    if (removed) prune();
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
  // Breakpoints (`md:liquid`) flip the flag without touching the DOM.
  addEventListener("resize", recheck);
  queue(root);

  return () => {
    closed = true;
    observer.disconnect();
    sizes?.disconnect();
    for (const list of lists) list.removeEventListener("change", recheck);
    removeEventListener("resize", recheck);
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(retry);
    for (const element of [...lensed.keys()]) release(element);
    dirty.clear();
    self.clear();
    sized.clear();
  };
}

/**
 * Turns the Liquid Glass lens on for the page. Every element whose computed style resolves to a
 * lensed liquid material (`--glass-lens: 1`: `liquid`, `liquid-clear` and their variants such as
 * `md:liquid`, and the glass and chrome surfaces under `data-glass="liquid"`) gets the refraction
 * engine, which is a lazy chunk fetched the first time one does (retried with a backoff if it
 * fails); the crystal and dispersion parts are further chunks, fetched only for surfaces that use
 * them. The decision follows the page: classes, inline styles, `data-glass`, `data-glass-lens`,
 * `data-style` and `data-theme` anywhere in the document, added and removed surfaces, resizes
 * (breakpoints and container queries), and the color scheme, transparency, contrast and motion
 * preferences. An element is considered when its class names contain `liquid`, `glass` or a
 * chrome surface (`surface-overlay`, `surface-nav`, `surface-side`), when its inline style sets
 * `--glass-lens`, or when it carries `data-glass-lens="on"` (use that for a custom class built
 * with `@apply`). `data-glass-lens="off"` on a surface or an ancestor, or `--glass-lens: 0`, keeps
 * the plain liquid look. Where the engine cannot paint (see {@link supportsBackdropRefraction})
 * it does nothing and loads nothing.
 *
 * A lens applied by code (`applyGlassRefraction`, `useGlassRefraction`) keeps its own options and
 * is never stopped by the watcher. Calls are counted: the page is watched until every returned
 * stop has run. Without it, liquid surfaces keep the CSS look (rim, depth, blur) and no lens code
 * is loaded at all.
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
