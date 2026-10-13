"use client";

import { type RefObject, useEffect, useRef } from "react";
import { TOUCH_TARGET } from "./chart-dock.js";

/** A finger that travels farther than this (px) is a swipe or scroll, never a selection. */
export const TAP_SLOP = 10;

/** Marks that can be the target of a tap: the hover targets charts flag, and category units. */
const MARK = "[data-chart-hit],[data-category]";
/** Details panel that stays pinned while it is read or scrolled. */
const KEEP = "[data-chart-dock],[data-chart-tooltip]";
const RING_DIRECTIONS = 8;
const RING_STEPS = 4;

type Point = { x: number; y: number };
interface Pin extends Point {
  target: Element;
  /** What the details read when the mark was pinned, to recognise a second tap on it. */
  text: string | null;
}

/** Events this hook replays, which it must not swallow or count as a finger again. */
const replayed = new WeakSet<Event>();

/**
 * Replays a hover. Entering keeps `touch` as the pointer type, so charts know a finger is on the
 * mark (they snap with a wider radius); leaving is sent as `mouse`, which every leave handler obeys.
 */
function emit(
  target: Element,
  type: string,
  at: Point,
  related: Element | null,
  pointerType: "mouse" | "touch" = "mouse",
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: at.x,
    clientY: at.y,
    pointerId: 1,
    pointerType,
    isPrimary: true,
    relatedTarget: related,
  });
  replayed.add(event);
  target.dispatchEvent(event);
}

/**
 * Touch selection for every chart, in one place. On a touch screen the browser turns a tap into
 * `pointerover`, `pointerdown`, `pointerup` and then `pointerout`, and a swipe into the same
 * start followed by `pointercancel`, so hover handlers either flash and vanish or select while
 * the page scrolls. This hook, attached to the plot element:
 *
 * - swallows touch `pointerover` / `pointerout`, so a lifted finger never counts as leaving;
 * - on a tap (up within `TAP_SLOP` of the press) finds the mark under the finger, or the nearest
 *   one within `TOUCH_TARGET` px, and replays a mouse hover on it: the details are pinned;
 * - tapping the pinned mark again (the details read the same), tapping outside the plot, tapping
 *   empty space or pressing Escape replays the mouse leaving, which unpins;
 * - leaves the pinned mark alone while the page scrolls.
 *
 * Mouse and pen events pass through untouched. `details` reads the text the chart currently
 * shows, which is how "the same mark" is recognised for charts with one hit area.
 */
export function useTouchSelection(
  ref: RefObject<HTMLElement | null>,
  details: () => string | null,
  enabled = true,
) {
  const read = useRef(details);
  read.current = details;

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const host: HTMLElement = root;
    let pin: Pin | null = null;
    let press: (Point & { id: number; moved: boolean }) | null = null;
    let settle = 0;

    const inside = (element: Element | null): element is Element =>
      element != null && element !== root && root.contains(element);

    const markOf = (element: Element | null): Element | null => {
      const mark = element?.closest(MARK) ?? null;
      return inside(mark) ? mark : null;
    };

    const pick = (at: Point): Element | null => {
      const marked = root.querySelector(MARK) != null;
      const direct = document.elementFromPoint(at.x, at.y);
      const mark = markOf(direct);
      if (mark) return mark;
      if (!marked) return inside(direct) ? direct : null;
      for (let step = 1; step <= RING_STEPS; step += 1) {
        const radius = (TOUCH_TARGET / RING_STEPS) * step;
        for (let k = 0; k < RING_DIRECTIONS; k += 1) {
          const angle = (k / RING_DIRECTIONS) * Math.PI * 2;
          const near = markOf(
            document.elementFromPoint(
              at.x + Math.cos(angle) * radius,
              at.y + Math.sin(angle) * radius,
            ),
          );
          if (near) return near;
        }
      }
      return null;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") release();
    };
    const onOutside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || root.contains(target) || target.closest(KEEP)) return;
      release();
    };

    function release() {
      cancelAnimationFrame(settle);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onOutside, true);
      const gone = pin;
      pin = null;
      if (!gone) return;
      // A re-render may have replaced the pinned node: leave from whatever is under it now.
      const target = gone.target.isConnected
        ? gone.target
        : inside(document.elementFromPoint(gone.x, gone.y))
          ? document.elementFromPoint(gone.x, gone.y)
          : host.firstElementChild;
      if (target) emit(target, "pointerout", gone, null);
    }

    const hold = () => {
      if (pin?.target.isConnected) {
        emit(pin.target, "pointerover", pin, null, "touch");
        emit(pin.target, "pointermove", pin, null, "touch");
      }
    };

    /**
     * A swipe began or the browser took the gesture: undo what touch moves selected. It runs after
     * the chart's own handlers have seen the event, so it has the last word.
     */
    let undoing: ReturnType<typeof setTimeout> | undefined;
    const abandon = (target: EventTarget | null) => {
      if (undoing !== undefined) return;
      undoing = setTimeout(() => {
        undoing = undefined;
        if (pin) hold();
        else if (target instanceof Element && target.isConnected)
          emit(target, "pointerout", { x: 0, y: 0 }, null);
      }, 0);
    };

    const tap = (at: Point) => {
      const mark = pick(at);
      if (!mark) {
        release();
        return;
      }
      const previous = pin;
      if (previous && previous.target !== mark) emit(previous.target, "pointerout", previous, mark);
      else if (!previous) {
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerdown", onOutside, true);
      }
      const next: Pin = { ...at, target: mark, text: null };
      pin = next;
      emit(mark, "pointerover", at, previous?.target ?? null, "touch");
      emit(mark, "pointermove", at, null, "touch");
      cancelAnimationFrame(settle);
      settle = requestAnimationFrame(() => {
        settle = requestAnimationFrame(() => {
          if (pin !== next) return;
          const text = read.current();
          const again =
            previous != null && (text != null ? text === previous.text : previous.target === mark);
          if (again) release();
          else next.text = text;
        });
      });
    };

    const swallow = (event: Event) => {
      if ((event as PointerEvent).pointerType === "touch" && !replayed.has(event))
        event.stopPropagation();
    };
    const onDown = (event: PointerEvent) => {
      if (replayed.has(event)) return;
      if (event.pointerType !== "touch") return;
      if (press && press.id !== event.pointerId) press.moved = true;
      else
        press = {
          x: event.clientX,
          y: event.clientY,
          id: event.pointerId,
          moved: !event.isPrimary,
        };
    };
    const onMove = (event: PointerEvent) => {
      if (replayed.has(event)) return;
      if (event.pointerType !== "touch" || !press || press.id !== event.pointerId) return;
      if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_SLOP)
        return;
      press.moved = true;
    };
    const onCancel = (event: PointerEvent) => {
      if (replayed.has(event)) return;
      if (event.pointerType !== "touch") return;
      if (press) abandon(event.target);
      press = null;
    };
    const onUp = (event: PointerEvent) => {
      if (replayed.has(event)) return;
      if (event.pointerType !== "touch") return;
      const current = press;
      press = null;
      if (!current || current.id !== event.pointerId) return;
      if (current.moved) abandon(event.target);
      else tap({ x: event.clientX, y: event.clientY });
    };

    const listen = (type: string, handler: (event: PointerEvent) => void) =>
      root.addEventListener(type, handler as EventListener, true);
    root.addEventListener("pointerover", swallow, true);
    root.addEventListener("pointerout", swallow, true);
    listen("pointerdown", onDown);
    listen("pointermove", onMove);
    listen("pointercancel", onCancel);
    listen("pointerup", onUp);
    return () => {
      root.removeEventListener("pointerover", swallow, true);
      root.removeEventListener("pointerout", swallow, true);
      root.removeEventListener("pointerdown", onDown as EventListener, true);
      root.removeEventListener("pointermove", onMove as EventListener, true);
      root.removeEventListener("pointercancel", onCancel as EventListener, true);
      root.removeEventListener("pointerup", onUp as EventListener, true);
      cancelAnimationFrame(settle);
      clearTimeout(undoing);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onOutside, true);
    };
  }, [ref, enabled]);
}
