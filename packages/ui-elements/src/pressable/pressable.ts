import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { attrOn } from "../internal/e2-attrs.js";
import css from "./pressable.css.js";

const RIPPLE_KEYFRAMES: Keyframe[] = [
  { transform: "scale(0)", opacity: 0.18 },
  { transform: "scale(1)", opacity: 0 },
];

/**
 * `<ui-pressable>`: wraps any content with press feedback, a ripple growing from the pointer and
 * a small scale-down (the preset's `--press-scale`). Both are skipped under
 * `prefers-reduced-motion`. It adds no semantics: put it around (or let it contain) the real
 * button or link.
 *
 * Attributes: `ripple` and `scale` (on by default; `"false"` turns one off), `disabled` (no
 * feedback, dimmed, ignores the pointer).
 */
export class UiPressable extends ElementBase {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = "<slot></slot>";
    this.addEventListener("pointerdown", this.#onPointerDown);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (!attrOn(this, "ripple") || this.disabled || typeof this.animate !== "function") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = this.getBoundingClientRect();
    const size = Math.hypot(rect.width, rect.height) * 2;
    const dot = document.createElement("span");
    dot.part.add("ripple");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      left: `${event.clientX - rect.left - size / 2}px`,
      top: `${event.clientY - rect.top - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
    this.shadowRoot?.append(dot);
    const run = dot.animate(RIPPLE_KEYFRAMES, {
      duration: 480,
      easing: "cubic-bezier(.2,.7,.3,1)",
    });
    run.onfinish = run.oncancel = () => dot.remove();
  };
}

/** Registers `<ui-pressable>` (or `<prefix-pressable>`) and returns the tag. */
export function definePressable(options?: DefineOptions): string {
  return defineElement("pressable", UiPressable, options);
}
