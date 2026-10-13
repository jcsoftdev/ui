import type { DragPoint, PointerDrag } from "@jcsoftdev/ui-core/pointer-drag";
import { type DefineOptions, defineElement } from "../internal/base.js";
import { ModalElement } from "../internal/modal.js";
import css from "./drawer.css.js";

type Side = "top" | "right" | "bottom" | "left";
const SIDES = new Set<string>(["top", "right", "bottom", "left"]);
/** Controls a press on must never start a swipe. */
const INTERACTIVE =
  'a, button, input, select, textarea, summary, label, [contenteditable], [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])';
/** Travel before a press becomes a swipe, so a tap or a jittery click never moves the panel. */
const SLOP = 6;
/** A flick only counts once the panel has moved this far, with speed read over the last window. */
const FLICK_MIN_OFFSET = 12;
const VELOCITY_WINDOW = 100;
const STALE_MS = 80;
/** Share of the panel (or px/ms of release speed) that makes a swipe a dismissal. */
const DISMISS_RATIO = 0.35;
const DISMISS_VELOCITY = 0.5;

/**
 * `<ui-drawer>`: a modal side panel on the native `<dialog>` (`showModal()`: top layer, inert page,
 * focus contained, moved in and returned to the opener, page scroll locked). Escape closes the
 * topmost modal layer only, so a drawer inside a dialog, or a popover inside the drawer, dismisses
 * one layer per press. Light DOM: the children move into the panel on first connect. Parts by
 * attribute: `data-drawer-title` and `data-drawer-description` (wired to `aria-labelledby` /
 * `aria-describedby`), `data-drawer-header`, `data-drawer-body`, `data-drawer-footer`, and
 * `data-drawer-close` on anything that should close it.
 *
 * Attributes: `open`, `side` (right | left | top | bottom, default right; physical edges, they
 * do not flip in RTL), `blocking` (no Escape,
 * no backdrop dismiss, no close button), `swipe="off"` (no swipe to dismiss), `close-label`,
 * `material` and the `liquid-*` options. A swipe toward the edge the drawer sits on dismisses it
 * when it passes about a third of the panel or is flicked; it starts on the grabber
 * (`data-drawer-handle`, added automatically; any element may carry it) or on the header, never on
 * a control inside them, so taps and text selection elsewhere are untouched. Open it with
 * `show()`, the `open` attribute or an invoker: `<button commandfor="id" command="--open">`
 * (`--close`, `--toggle`). A `blocking` drawer cannot be swiped either. Fires `open`, `close` and a cancelable `cancel` (Escape, backdrop, close
 * button, swipe). The panel slides in and out; `prefers-reduced-motion` removes the motion.
 */
export class UiDrawer extends ModalElement {
  static override observedAttributes = [...ModalElement.observedAttributes, "side", "swipe"];
  protected readonly ui = "drawer";
  protected readonly css = css;

  #drag: PointerDrag | undefined;
  #handle: HTMLElement | undefined;
  #dragLoading = false;
  #waitLoading = false;
  #wait: ((node: HTMLElement, done: () => void) => () => void) | undefined;

  get side(): Side {
    const side = this.getAttribute("side") ?? "";
    return SIDES.has(side) ? (side as Side) : "right";
  }
  set side(value: Side) {
    this.setAttribute("side", value);
  }

  override attributeChangedCallback(name: string): void {
    if (name === "swipe") this.#syncSwipe();
    else if (name !== "side") super.attributeChangedCallback(name);
    if (name === "blocking") this.#syncSwipe();
  }

  protected override built(panel: HTMLDialogElement): void {
    this.#handle = document.createElement("span");
    this.#handle.dataset.uiPart = "handle";
    this.#handle.setAttribute("data-drawer-handle", "");
    this.#handle.setAttribute("aria-hidden", "true");
    panel.prepend(this.#handle);
    this.#handle.hidden = !this.#swipeable || this.hasAttribute("blocking");
  }

  protected override shown(panel: HTMLDialogElement): void {
    panel.dataset.state = "open";
    panel.style.removeProperty("translate");
    this.#syncSwipe();
    // The exit helper is fetched on first open, so the close can wait for the slide-out.
    if (!this.#wait && !this.#waitLoading) {
      this.#waitLoading = true;
      import("@jcsoftdev/ui-core/presence").then(({ waitForExit }) => {
        this.#wait = waitForExit;
      });
    }
  }

  protected override exit(panel: HTMLDialogElement, done: () => void): (() => void) | undefined {
    panel.dataset.state = "closed";
    this.#drag?.cancel();
    panel.removeAttribute("data-dragging");
    panel.style.removeProperty("translate");
    if (!this.#wait || !panel.open) return undefined;
    return this.#wait(panel, done);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#drag?.destroy();
    this.#drag = undefined;
  }

  get #swipeable(): boolean {
    return this.getAttribute("swipe") !== "off";
  }

  #syncSwipe(): void {
    const panel = this.panel;
    if (!panel) return;
    if (this.#handle) this.#handle.hidden = !this.#swipeable || this.hasAttribute("blocking");
    if (!this.#swipeable) {
      this.#drag?.destroy();
      this.#drag = undefined;
      return;
    }
    if (this.#drag || this.#dragLoading || !this.open) return;
    this.#dragLoading = true;
    import("@jcsoftdev/ui-core/pointer-drag").then(({ createPointerDrag }) => {
      this.#dragLoading = false;
      if (this.#drag || !this.#swipeable || !this.isConnected) return;
      this.#drag = this.#bindDrag(panel, createPointerDrag);
    });
  }

  #bindDrag(
    panel: HTMLDialogElement,
    createPointerDrag: typeof import("@jcsoftdev/ui-core/pointer-drag").createPointerDrag,
  ): PointerDrag {
    let samples: { at: number; offset: number }[] = [];
    /** Release speed in px/ms over the last {@link VELOCITY_WINDOW}; 0 once the pointer rested. */
    const speedAt = (now: number): number => {
      const end = samples[samples.length - 1];
      if (!end || now - end.at > STALE_MS) return 0;
      const from = samples.find((sample) => end.at - sample.at <= VELOCITY_WINDOW) ?? end;
      return end.at > from.at ? (end.offset - from.offset) / (end.at - from.at) : 0;
    };
    /** Distance dragged toward the edge the drawer sits on; 0 when going the other way. */
    const offsetOf = ({ dx, dy }: DragPoint): number => {
      switch (this.side) {
        case "right":
          return Math.max(0, dx);
        case "left":
          return Math.max(0, -dx);
        case "bottom":
          return Math.max(0, dy);
        default:
          return Math.max(0, -dy);
      }
    };
    const vertical = () => this.side === "top" || this.side === "bottom";
    const sign = () => (this.side === "right" || this.side === "bottom" ? 1 : -1);
    return createPointerDrag(panel, {
      disabled: () => !this.open || this.hasAttribute("blocking"),
      slop: SLOP,
      onStart: (_point, event) => {
        // Walk the composed path so a control inside a shadow root (ui-button) counts too.
        let grip = false;
        for (const node of event.composedPath()) {
          if (node === panel) break;
          if (!(node instanceof Element)) continue;
          if (node.matches(INTERACTIVE)) return false;
          if (node.matches("[data-drawer-handle], [data-drawer-header]")) grip = true;
        }
        if (!grip) return false;
        samples = [{ at: event.timeStamp, offset: 0 }];
        return true;
      },
      onMove: (point, event) => {
        const offset = offsetOf(point);
        samples.push({ at: event.timeStamp, offset });
        if (samples.length > 12) samples.shift();
        panel.setAttribute("data-dragging", "");
        panel.style.translate = vertical() ? `0 ${sign() * offset}px` : `${sign() * offset}px 0`;
      },
      onEnd: (point, cancelled) => {
        const offset = offsetOf(point);
        const size = vertical() ? panel.offsetHeight : panel.offsetWidth;
        panel.removeAttribute("data-dragging");
        const dismiss =
          !cancelled &&
          size > 0 &&
          (offset / size >= DISMISS_RATIO ||
            (offset >= FLICK_MIN_OFFSET && speedAt(performance.now()) > DISMISS_VELOCITY));
        if (dismiss) this.requestDismiss();
        // Released short of the threshold, or the close was vetoed: spring back (CSS transition).
        if (!dismiss || this.open) panel.style.removeProperty("translate");
      },
    });
  }
}

/** Registers `<ui-drawer>` (or `<prefix-drawer>`) and returns the tag. */
export function defineDrawer(options?: DefineOptions): string {
  return defineElement("drawer", UiDrawer, options);
}
