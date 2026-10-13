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

const AUTO_PRESSABLE = 'button, a, [role="button"], [data-glass-interactive]';

export interface LiquidMotionHooks {
  /** The multiplier of the lens strength this frame: the materialise ramp times the press lift. */
  onLevel(level: number): void;
}

export interface LiquidMotionOptions {
  /** Ramp the lens strength from 0 to its target (the first install of a surface). */
  materialize: boolean;
  /** `false`: no listeners, no springs; the lens is at full strength at once. */
  interactive?: boolean;
}

export interface LiquidMotion {
  dispose(): void;
}

const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const SPRING_NAMES = ["snappy", "smooth", "soft", "jelly"] as const;

/** `--liquid-motion` / `--liquid-interactive` of an element, with the defaults of an unconfigured one. */
export function readMotion(element: HTMLElement): {
  spring: SpringConfig | undefined;
  mode: "none" | "press" | "drag";
} {
  const computed = getComputedStyle(element);
  const motion = computed.getPropertyValue("--liquid-motion").trim();
  const interactive = computed.getPropertyValue("--liquid-interactive").trim();
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
 * `prefers-reduced-motion`. The surface's `transform` and `scale` belong to the engine while it
 * moves and are given back at rest.
 */
export function startLiquidMotion(
  element: HTMLElement,
  hooks: LiquidMotionHooks,
  { materialize, interactive = true }: LiquidMotionOptions,
): LiquidMotion | undefined {
  if (reduced()) return undefined;
  const { spring, mode } = readMotion(element);
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
  let origin = { x: 0, y: 0 };
  let lit = false;
  let frame = 0;
  let last = 0;
  const priorScale = element.style.scale;
  const priorTouch = element.style.touchAction;
  const pointerMode = mode !== "none";
  if (pointerMode) element.style.scale = "1";
  if (mode === "drag") element.style.touchAction = "none";
  const pointerUp = new Set<string>(["pointerup", "pointercancel"]);

  const tracked = [intro, press, glow, x, y, scaleX, scaleY, lightX, lightY];
  const asleep = () => tracked.every((s) => isAtRest(s));

  const apply = () => {
    hooks.onLevel(Math.max(intro.value, 0) * (1 + PRESS_LIFT * Math.max(press.value, 0)));
    if (!pointerMode) return;
    const width = Math.max(element.offsetWidth, 1);
    const swell = 1 + Math.min(SWELL_PX / width, SWELL_MAX) * press.value;
    element.style.transform =
      `translate(${x.value.toFixed(2)}px, ${y.value.toFixed(2)}px) ` +
      `scale(${(scaleX.value * swell).toFixed(4)}, ${(scaleY.value * swell).toFixed(4)})`;
    element.style.setProperty("--liquid-glow", glow.value.toFixed(3));
    if (lit) {
      const angle = (Math.atan2(lightY.value, lightX.value) * 180) / Math.PI;
      const style = getComputedStyle(element);
      const strength = Number.parseFloat(style.getPropertyValue("--liquid-rim-strength"));
      const fresnel = Number.parseFloat(style.getPropertyValue("--liquid-fresnel"));
      element.style.setProperty(
        "--liquid-rim-auto",
        liquidRim(
          Number.isFinite(strength) ? strength : 1,
          angle,
          Number.isFinite(fresnel) ? fresnel : 0,
        ),
      );
    }
  };

  /** Everything reached its target: snap onto it, drop the transform, and with the pointer gone the glow. */
  const rest = () => {
    for (const s of tracked) settle(s);
    apply();
    if (!pointerMode || pressed) return;
    // At identity there is nothing to keep: no transform (and the stacking context it implies).
    element.style.removeProperty("transform");
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
      if (Math.hypot(dx, dy) > DRAG_SLOP) moved = true;
      const reach = Math.hypot(dx, dy);
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
    if (pressed && mode !== "drag") return release();
    if (!pressed) {
      glow.target = 0;
      wake();
    }
  };
  const release = () => {
    if (!pressed) return;
    pressed = false;
    dragging = false;
    press.target = 0;
    glow.target = hovering ? 0.4 : 0;
    x.target = 0;
    y.target = 0;
    scaleX.target = 1;
    scaleY.target = 1;
    if (moved && mode === "drag") {
      const swallow = (event: Event) => event.stopImmediatePropagation();
      element.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => element.removeEventListener("click", swallow, true), 0);
    }
    moved = false;
    wake();
  };
  const onDown = (event: PointerEvent) => {
    if (event.button > 0) return;
    pressed = true;
    dragging = true;
    moved = false;
    origin = { x: event.clientX, y: event.clientY };
    press.target = 1;
    glow.target = 1;
    track(event);
    if (mode === "drag") {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is gone already (or synthetic): the drag then ends with the next up event.
      }
    }
    wake();
  };

  if (pointerMode) {
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    for (const type of pointerUp) element.addEventListener(type, release);
    element.addEventListener("lostpointercapture", release);
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
        element.style.removeProperty("transform");
        element.style.removeProperty("--liquid-glow");
        element.style.removeProperty("--liquid-glow-x");
        element.style.removeProperty("--liquid-glow-y");
        element.style.removeProperty("--liquid-rim-auto");
        element.style.scale = priorScale;
        element.style.touchAction = priorTouch;
      }
    },
  };
}
