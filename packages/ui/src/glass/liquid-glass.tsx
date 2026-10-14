"use client";

import { useEffect } from "react";
import { supportsBackdropRefraction } from "./support.js";

type Engine = typeof import("./refraction.js");

/**
 * Elements that may resolve to a lensed liquid material. The decision itself is the computed
 * `--glass-lens` flag, so variants (`md:liquid`, `dark:liquid`, `data-[state=open]:liquid`) and
 * CSS-only toggles count; a custom class built with `@apply liquid` needs `data-glass-lens="on"`.
 */
const CANDIDATES = [
  '[class*="liquid"]',
  '[class*="glass"]',
  '[class*="surface-overlay"]',
  '[class*="surface-nav"]',
  '[class*="surface-side"]',
  '[style*="--glass-lens:"]',
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
/** Attributes the engine itself writes: never a reason to look again. */
const ENGINE_ATTRIBUTES = new Set(["data-glass-refraction", "data-glass-lens-layer"]);
/**
 * Attribute changes that can flip the flag on the element or its subtree: classes, inline styles,
 * and the state attributes variants select on (`data-*`, `aria-*`, `open`).
 */
const followed = (name: string) =>
  name === "class" ||
  name === "style" ||
  name === "open" ||
  name.startsWith("aria-") ||
  (name.startsWith("data-") && !ENGINE_ATTRIBUTES.has(name));
/** Subtrees rescanned per frame; more wait for the next frames. */
const SCANS_PER_FRAME = 64;
/** Pending subtrees above which one scan of the document replaces them (once, not per frame). */
const MAX_PENDING = 512;
/** Quiet time after the last window resize before the candidates are checked again. */
const RESIZE_MS = 150;
/** Attempts to fetch the engine chunk before giving up for this watcher. */
const MAX_ATTEMPTS = 6;
const RETRY_MAX_MS = 30_000;

const defaultLoader = (): Promise<Engine> => import("./refraction.js");
let loadEngine = defaultLoader;
/** Delay before retrying a failed engine chunk, doubled per failure. */
let retryMs = 500;

/**
 * Test seam: replaces how the engine chunk is fetched and the first retry delay (`undefined`
 * restores both). Not part of the public entries.
 */
export function setLiquidEngineLoader(loader?: () => Promise<Engine>, firstRetryMs = 500): void {
  loadEngine = loader ?? defaultLoader;
  retryMs = firstRetryMs;
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
  /** Every candidate seen, under the size observer; a resize or a preference rechecks these only. */
  const known = new Set<HTMLElement>();
  /** The nearest size container of each candidate, and the candidates under each container. */
  const containerOf = new WeakMap<HTMLElement, Element | null>();
  const underContainer = new Map<Element, Set<HTMLElement>>();
  /** Targets whose first size notification (the one `observe` always sends) is still due. */
  const unprimed = new WeakSet<Element>();
  /** The inline `--glass-lens` last seen per element, so other inline style writes are ignored. */
  const inlineFlag = new WeakMap<Element, string>();
  let frame = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const release = (element: HTMLElement) => {
    lensed.get(element)?.();
    lensed.delete(element);
  };

  const wants = (element: HTMLElement) => {
    if (!element.isConnected || element.closest('[data-glass-lens="off"]')) return false;
    const style = getComputedStyle(element);
    // A descendant that only inherits the flag paints no backdrop: it is not a surface. The lens
    // replaces the surface's inline backdrop filter (a crystal lens moves it to its own layer), so
    // for a surface this watcher lensed the computed value says nothing; the engine reads what the
    // surface's own styles resolve to. The inherited flag alone never keeps a lens alive, or a
    // surface whose own `liquid` stopped applying (`data-[state=open]:liquid` closing) under a
    // lensed ancestor would keep it, while an attribute change above a live one still leaves it.
    const lensedHere = lensed.has(element) && element.dataset.glassRefraction === "on";
    const backdrop =
      lensedHere && engine ? engine.ownBackdropFilter(element) : style.backdropFilter;
    return (
      style.getPropertyValue("--glass-lens").trim() === "1" &&
      backdrop !== "none" &&
      style.visibility !== "hidden"
    );
  };

  const load = () => {
    if (loading || failures >= MAX_ATTEMPTS || Date.now() < retryAt) return;
    loading = true;
    let fetched: Promise<Engine>;
    try {
      fetched = loadEngine();
    } catch (error) {
      fetched = Promise.reject(error);
    }
    // The engine is its own chunk, fetched the first time a surface resolves to a lensed liquid.
    fetched.then(
      (module) => {
        engine = module;
        failures = 0;
        if (!closed) recheckKnown();
      },
      () => {
        loading = false;
        failures++;
        // After the last attempt the page keeps the plain liquid look, quietly.
        if (closed || failures >= MAX_ATTEMPTS) return;
        const delay = Math.min(RETRY_MAX_MS, retryMs * 2 ** (failures - 1));
        retryAt = Date.now() + delay;
        retry = setTimeout(recheckKnown, delay);
      },
    );
  };

  const observeSize = (target: Element) => {
    if (!sizes) return;
    unprimed.add(target);
    sizes.observe(target);
  };

  /** The nearest ancestor that is a size container, so a container query is followed. */
  const findContainer = (element: HTMLElement) => {
    for (let node = element.parentElement; node && node !== root; node = node.parentElement)
      if (getComputedStyle(node).containerType !== "normal") return node;
    return null;
  };

  const remember = (element: HTMLElement) => {
    if (known.has(element)) return;
    known.add(element);
    observeSize(element);
    const container = findContainer(element);
    containerOf.set(element, container);
    if (!container) return;
    let members = underContainer.get(container);
    if (!members) {
      members = new Set();
      underContainer.set(container, members);
      observeSize(container);
    }
    members.add(element);
  };

  const forget = (element: HTMLElement) => {
    if (!known.delete(element)) return;
    sizes?.unobserve(element);
    release(element);
    self.delete(element);
    const container = containerOf.get(element);
    const members = container && underContainer.get(container);
    if (!members) return;
    members.delete(element);
    if (members.size === 0 && container) {
      underContainer.delete(container);
      sizes?.unobserve(container);
    }
  };

  const check = (element: HTMLElement) => {
    inlineFlag.set(element, element.style.getPropertyValue("--glass-lens"));
    remember(element);
    if (!wants(element)) release(element);
    else if (lensed.has(element)) return;
    else if (engine)
      // The pointer mode of an automatic lens is the surface's own (its `style` or
      // `data-glass-interactive`): a scope above it never makes it pressable or draggable.
      lensed.set(element, engine.claimLens(element, "auto", { auto: true, ownInteractive: true }));
    else load();
  };

  const scan = (node: Element) => {
    // A lensed surface whose class changed to something that no longer matches is still checked.
    if (node.matches(CANDIDATES) || known.has(node as HTMLElement)) check(node as HTMLElement);
    for (const element of node.querySelectorAll<HTMLElement>(CANDIDATES)) check(element);
  };

  /** Lets go of the candidates in a removed subtree, without waiting for a frame. */
  const prune = (node: Element) => {
    if (node.isConnected) return; // moved, not removed
    dirty.delete(node);
    if (node instanceof HTMLElement && known.has(node)) forget(node);
    for (const element of node.querySelectorAll<HTMLElement>(CANDIDATES)) forget(element);
  };

  const flush = () => {
    frame = 0;
    let budget = SCANS_PER_FRAME;
    for (const node of dirty) {
      if (budget-- <= 0) break;
      dirty.delete(node);
      if (node.isConnected) scan(node);
    }
    const singles = [...self];
    self.clear();
    for (const element of singles) if (element.isConnected) check(element);
    if (dirty.size) later();
  };

  function later() {
    if (!frame && !closed) frame = requestAnimationFrame(flush);
  }

  function queue(node: Element) {
    if (!dirty.has(root)) {
      if (dirty.size >= MAX_PENDING) {
        // A hidden tab runs no frames: keep one pending scan instead of an unbounded list.
        dirty.clear();
        dirty.add(root);
      } else dirty.add(node);
    }
    later();
  }

  function recheckKnown() {
    for (const element of known) self.add(element);
    later();
  }

  const sizes =
    typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) => {
          for (const { target } of entries) {
            if (unprimed.has(target)) {
              unprimed.delete(target);
              continue;
            }
            // A container query or a size-dependent rule can flip the flag of these candidates.
            const members = underContainer.get(target);
            if (members) for (const element of members) self.add(element);
            if (known.has(target as HTMLElement)) self.add(target as HTMLElement);
          }
          later();
        })
      : undefined;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        const name = record.attributeName ?? "";
        if (!followed(name)) continue;
        const target = record.target as HTMLElement;
        if (name === "style") {
          // Inline styles change every frame under the motion; only the flag itself matters.
          const flag = target.style?.getPropertyValue("--glass-lens") ?? "";
          if (inlineFlag.has(target) && inlineFlag.get(target) === flag) continue;
          inlineFlag.set(target, flag);
        }
        queue(target);
      } else {
        for (const node of record.removedNodes) if (node instanceof Element) prune(node);
        for (const node of record.addedNodes) if (node instanceof Element) queue(node);
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  const lists = PREFERENCES.map((query) => matchMedia(query));
  for (const list of lists) list.addEventListener("change", recheckKnown);
  // Breakpoints (`md:liquid`) flip the flag without touching the DOM: once the resize settles,
  // look at the known candidates again (not the whole document).
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(recheckKnown, RESIZE_MS);
  };
  addEventListener("resize", onResize);
  queue(root);

  return () => {
    closed = true;
    observer.disconnect();
    sizes?.disconnect();
    for (const list of lists) list.removeEventListener("change", recheckKnown);
    removeEventListener("resize", onResize);
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(retry);
    clearTimeout(resizeTimer);
    for (const element of [...lensed.keys()]) release(element);
    dirty.clear();
    self.clear();
    known.clear();
    underContainer.clear();
  };
}

/**
 * Turns the Liquid Glass lens on for the page. Every surface whose computed style resolves to a
 * lensed liquid material (`--glass-lens: 1` with a backdrop filter: `liquid`, `liquid-clear` and
 * their variants such as `md:liquid`, and the glass and chrome surfaces under
 * `data-glass="liquid"`) gets the refraction engine, which is a lazy chunk fetched the first time
 * one does (retried a few times with a backoff if it fails); the crystal and dispersion parts are
 * further chunks, fetched only for surfaces that use them.
 *
 * Followed: added and removed elements; changes of `class`, `style` (the inline `--glass-lens`),
 * `open`, and any `data-*` or `aria-*` attribute on an element or an ancestor (state variants such
 * as `data-[state=open]:liquid` and `group-*` ones); the window size, once a resize settles
 * (breakpoints); the size of the candidate and of its nearest size container (container queries);
 * and the color scheme, transparency, contrast and motion preferences. Not followed: pseudo-classes
 * (`hover:liquid`, `focus:liquid`) and sibling variants (`peer-*`); for those keep the surface
 * liquid, or lens it with `applyGlassRefraction` from `@jcsoftdev/ui/glass`.
 *
 * An element is considered when its class names contain `liquid`, `glass` or a chrome surface
 * (`surface-overlay`, `surface-nav`, `surface-side`), when its inline style sets `--glass-lens`,
 * or when it carries `data-glass-lens="on"` (use that for a custom class built with `@apply`).
 * `data-glass-lens="off"` on a surface or an ancestor, or `--glass-lens: 0`, keeps the plain
 * liquid look. Where the engine cannot paint (see {@link supportsBackdropRefraction}) it does
 * nothing and loads nothing.
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
