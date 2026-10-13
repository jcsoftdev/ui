import { liquidRim } from "./liquid-options.js";
import {
  createSpring,
  isAtRest,
  rubberBand,
  SPRINGS,
  type SpringConfig,
  settle,
  squashTarget,
  stepSpring,
} from "./spring.js";

/** How much deeper the lens bends at full press. */
export const PRESS_LIFT = 0.35;
/** The surface grows by about this many px (over its width) at full press. */
export const SWELL_PX = 16;
/** Largest swell, as a scale. */
const SWELL_MAX = 0.12;
/** How far a pressed (not dragged) control follows the pointer, and how far a drag stretches. */
export const FOLLOW_LIMIT = 4;
export const DRAG_LIMIT = 48;
/** Pointer travel (px) after which a drag is a drag and the click that ends it is swallowed. */
const DRAG_SLOP = 6;
/** How long after a drag's pointer-up its click can still arrive (a touch click is delayed). */
const SWALLOW_MS = 350;

const AUTO_PRESSABLE = 'button, a, [role="button"], [data-glass-interactive]';
/** A pointer-down on one of these inside the surface belongs to it, not to the surface's gesture. */
const INTERACTIVE_CHILD =
  'button, a, input, select, textarea, summary, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])';

export interface LiquidMotionHooks {
  /** The multiplier of the lens strength this frame: the materialise ramp times the press lift. */
  onLevel(level: number): void;
}

export interface LiquidMotionOptions {
  /** Ramp the lens strength from 0 to its target (the first install of a surface). */
  materialize: boolean;
  /** `false`: no listeners, no springs; the lens is at full strength at once. */
  interactive?: boolean;
  /**
   * Read the pointer mode only from the element itself (its inline `--liquid-interactive` or its
   * `data-glass-interactive` value), never from a scope or theme above it. For overlays (dialog,
   * popover, sidebar, drawer): a page-level `--liquid-interactive: drag` must not make them
   * draggable.
   */
  ownInteractive?: boolean;
}

export interface LiquidMotion {
  dispose(): void;
}

const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const SPRING_NAMES = ["snappy", "smooth", "soft", "jelly"] as const;

/**
 * `--liquid-motion` / `--liquid-interactive` of an element, with the defaults of an unconfigured
 * one. `own`: the pointer mode comes only from the element's inline style or
 * `data-glass-interactive`, not from what it inherits.
 */
export function readMotion(
  element: HTMLElement,
  own = false,
): {
  spring: SpringConfig | undefined;
  mode: "none" | "press" | "drag";
} {
  const computed = getComputedStyle(element);
  const motion = computed.getPropertyValue("--liquid-motion").trim();
  const interactive = own
    ? element.style.getPropertyValue("--liquid-interactive").trim() ||
      (element.getAttribute("data-glass-interactive") ?? "").trim()
    : computed.getPropertyValue("--liquid-interactive").trim();
  const mode =
    interactive === "none" || interactive === "press" || interactive === "drag"
      ? interactive
      : element.matches(AUTO_PRESSABLE)
        ? "press"
        : "none";
  const named = SPRING_NAMES.find((name) => name === motion);
  return {
    spring: motion === "off" ? undefined : SPRINGS[named ?? "snappy"],
    mode,
  };
}

/**
 * Motion of a lensed surface, driven by one rAF loop of springs that sleeps once everything is at
 * rest. Always: the lens materialises (its strength springs from 0 to its target). With a pointer
 * mode (`--liquid-interactive`, by default `press` on buttons and links): a press deepens the lens
 * and swells the surface, lights a touch glow that follows the pointer and turns the rim light
 * towards it; `drag` also pulls the surface along (rubber band) with the speed squashing it, and
 * releases it into a jelly settle. `--liquid-motion: off` turns all of it off. Does nothing under
 * `prefers-reduced-motion`.
 *
 * The motion is written to the individual `translate` and `scale` properties, composed with the
 * author's own values (read when a burst of motion starts), so an author `transform` is never
 * touched; at rest the author's inline `translate` and `scale` are put back. A drag starts only
 * on the surface itself (not on a button, link or field inside it), captures the pointer only
 * once it has travelled past the slop, and swallows only the click that ends that gesture.
 */
export function startLiquidMotion(
  element: HTMLElement,
  hooks: LiquidMotionHooks,
  { materialize, interactive = true, ownInteractive = false }: LiquidMotionOptions,
): LiquidMotion | undefined {
  if (reduced()) return undefined;
  const { spring, mode } = readMotion(element, ownInteractive);
  if (!spring || !interactive) return undefined;

  const intro = createSpring(materialize ? 0 : 1, 1);
  const press = createSpring(0);
  const glow = createSpring(0);
  const x = createSpring(0);
  const y = createSpring(0);
  const scaleX = createSpring(1);
  const scaleY = createSpring(1);
  // The light is a direction: its two components are sprung, so the angle never wraps.
  const lightX = createSpring(0);
  const lightY = createSpring(0);
  let hovering = false;
  let dragging = false;
  let pressed = false;
  let moved = false;
  let captured: number | undefined;
  let swallow = false;
  let swallowTimer: ReturnType<typeof setTimeout> | undefined;
  let origin = { x: 0, y: 0 };
  let lit = false;
  let frame = 0;
  let last = 0;
  const priorTranslate = element.style.getPropertyValue("translate");
  const priorScale = element.style.getPropertyValue("scale");
  const priorTouch = element.style.touchAction;
  const pointerMode = mode !== "none";
  if (mode === "drag") element.style.touchAction = "none";
  /** What one burst of motion reads once, so no frame reads layout or style after its writes. */
  let base = {
    translate: [] as string[],
    scale: [] as number[],
    width: 1,
    strength: 1,
    fresnel: 0,
  };
  const readBase = () => {
    const computed = getComputedStyle(element);
    const words = (value: string) => (value === "none" ? [] : value.split(/\s+/).filter(Boolean));
    const number = (value: string) => {
      const n = Number.parseFloat(value);
      return value.endsWith("%") ? n / 100 : n;
    };
    const strength = Number.parseFloat(computed.getPropertyValue("--liquid-rim-strength"));
    const fresnel = Number.parseFloat(computed.getPropertyValue("--liquid-fresnel"));
    base = {
      translate: words(computed.getPropertyValue("translate")),
      scale: words(computed.getPropertyValue("scale")).map(number),
      width: Math.max(element.offsetWidth, 1),
      strength: Number.isFinite(strength) ? strength : 1,
      fresnel: Number.isFinite(fresnel) ? fresnel : 0,
    };
  };
  if (pointerMode) readBase();
  const setProp = (name: string, value: string) =>
    value ? element.style.setProperty(name, value) : element.style.removeProperty(name);
  const pointerUp = new Set<string>(["pointerup", "pointercancel"]);

  const tracked = [intro, press, glow, x, y, scaleX, scaleY, lightX, lightY];
  const asleep = () => tracked.every((s) => isAtRest(s));

  const apply = () => {
    hooks.onLevel(Math.max(intro.value, 0) * (1 + PRESS_LIFT * Math.max(press.value, 0)));
    if (!pointerMode) return;
    const swell = 1 + Math.min(SWELL_PX / base.width, SWELL_MAX) * press.value;
    const [ax = "0px", ay = "0px", az] = base.translate;
    setProp(
      "translate",
      `calc(${ax} + ${x.value.toFixed(2)}px) calc(${ay} + ${y.value.toFixed(2)}px)` +
        (az ? ` ${az}` : ""),
    );
    const [sx = 1, sy = sx, sz] = base.scale;
    setProp(
      "scale",
      `${(sx * scaleX.value * swell).toFixed(4)} ${(sy * scaleY.value * swell).toFixed(4)}` +
        (sz === undefined ? "" : ` ${sz}`),
    );
    element.style.setProperty("--liquid-glow", glow.value.toFixed(3));
    if (lit) {
      const angle = (Math.atan2(lightY.value, lightX.value) * 180) / Math.PI;
      element.style.setProperty("--liquid-rim-auto", liquidRim(base.strength, angle, base.fresnel));
    }
  };

  /** Everything reached its target: snap onto it, give `translate` and `scale` back, and with the pointer gone the glow. */
  const rest = () => {
    for (const s of tracked) settle(s);
    apply();
    if (!pointerMode || pressed) return;
    // At identity there is nothing to keep: the author's own values (and their stacking context).
    setProp("translate", priorTranslate);
    setProp("scale", priorScale);
    if (!hovering) {
      element.style.removeProperty("--liquid-glow");
      element.style.removeProperty("--liquid-rim-auto");
      lit = false;
    }
  };

  const tick = (now: number) => {
    frame = 0;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    stepSpring(intro, SPRINGS.smooth, dt);
    stepSpring(press, spring, dt);
    stepSpring(glow, SPRINGS.soft, dt);
    // Followed with the soft spring while the pointer holds it, released into the jelly.
    const follow = dragging ? SPRINGS.follow : SPRINGS.jelly;
    stepSpring(x, follow, dt);
    stepSpring(y, follow, dt);
    if (mode === "drag") {
      const target = squashTarget(x.velocity, y.velocity);
      scaleX.target = target.x;
      scaleY.target = target.y;
    }
    stepSpring(scaleX, SPRINGS.squashX, dt);
    stepSpring(scaleY, SPRINGS.squashY, dt);
    stepSpring(lightX, SPRINGS.soft, dt);
    stepSpring(lightY, SPRINGS.soft, dt);
    if (asleep()) rest();
    else {
      apply();
      frame = requestAnimationFrame(tick);
    }
  };
  const wake = () => {
    if (frame) return;
    if (pointerMode) readBase();
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const local = (event: PointerEvent) => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top, box };
  };
  const track = (event: PointerEvent) => {
    const { x: px, y: py, box } = local(event);
    element.style.setProperty("--liquid-glow-x", `${px.toFixed(1)}px`);
    element.style.setProperty("--liquid-glow-y", `${py.toFixed(1)}px`);
    // The light comes from the pointer: the wall facing it is the lit one.
    const dx = px - box.width / 2;
    const dy = py - box.height / 2;
    const length = Math.hypot(dx, dy) || 1;
    lightX.target = dx / length;
    lightY.target = dy / length;
    lit = true;
  };

  const onEnter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovering = true;
    glow.target = pressed ? 1 : 0.4;
    track(event);
    wake();
  };
  const onMove = (event: PointerEvent) => {
    if (!hovering && !pressed) return;
    track(event);
    if (dragging) {
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      const reach = Math.hypot(dx, dy);
      if (reach > DRAG_SLOP && !moved) {
        moved = true;
        // Only a real drag takes the pointer: until then a press on a child is the child's.
        if (mode === "drag") capture(event.pointerId);
      }
      const limit = mode === "drag" ? DRAG_LIMIT : FOLLOW_LIMIT;
      const k = reach > 0 ? rubberBand(reach, limit) / reach : 0;
      x.target = dx * k;
      y.target = dy * k;
    }
    wake();
  };
  const onLeave = () => {
    hovering = false;
    // Without pointer capture the release would happen outside and never be heard.
    if (pressed && captured === undefined) return release();
    if (!pressed) {
      glow.target = 0;
      wake();
    }
  };
  const capture = (pointerId: number) => {
    try {
      element.setPointerCapture(pointerId);
      captured = pointerId;
    } catch {
      // The pointer is gone already (or synthetic): the drag then ends with the next up event.
    }
  };
  const clearSwallow = () => {
    swallow = false;
    clearTimeout(swallowTimer);
    swallowTimer = undefined;
  };
  /** The click that ends a drag belongs to the drag; this one gesture's click, and no other. */
  const onClick = (event: Event) => {
    if (!swallow) return;
    clearSwallow();
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  const release = () => {
    if (!pressed) return;
    pressed = false;
    dragging = false;
    captured = undefined;
    press.target = 0;
    glow.target = hovering ? 0.4 : 0;
    x.target = 0;
    y.target = 0;
    scaleX.target = 1;
    scaleY.target = 1;
    if (moved && mode === "drag") {
      swallow = true;
      swallowTimer = setTimeout(clearSwallow, SWALLOW_MS);
    }
    moved = false;
    wake();
  };
  const onDown = (event: PointerEvent) => {
    if (event.button > 0) return;
    // A new gesture: whatever click the last drag left unswallowed is not this one's.
    clearSwallow();
    const inner = event.target instanceof Element ? event.target.closest(INTERACTIVE_CHILD) : null;
    if (inner && inner !== element && element.contains(inner)) return;
    pressed = true;
    dragging = true;
    moved = false;
    origin = { x: event.clientX, y: event.clientY };
    press.target = 1;
    glow.target = 1;
    track(event);
    wake();
  };

  if (pointerMode) {
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    for (const type of pointerUp) element.addEventListener(type, release);
    element.addEventListener("lostpointercapture", release);
    element.addEventListener("click", onClick, true);
  }
  if (materialize) {
    apply();
    wake();
  } else hooks.onLevel(1);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (pointerMode) {
        element.removeEventListener("pointerenter", onEnter);
        element.removeEventListener("pointerleave", onLeave);
        element.removeEventListener("pointerdown", onDown);
        element.removeEventListener("pointermove", onMove);
        for (const type of pointerUp) element.removeEventListener(type, release);
        element.removeEventListener("lostpointercapture", release);
        element.removeEventListener("click", onClick, true);
        clearSwallow();
        if (captured !== undefined) {
          try {
            element.releasePointerCapture(captured);
          } catch {
            // Already released.
          }
        }
        setProp("translate", priorTranslate);
        setProp("scale", priorScale);
        element.style.removeProperty("--liquid-glow");
        element.style.removeProperty("--liquid-glow-x");
        element.style.removeProperty("--liquid-glow-y");
        element.style.removeProperty("--liquid-rim-auto");
        element.style.touchAction = priorTouch;
      }
    },
  };
}
