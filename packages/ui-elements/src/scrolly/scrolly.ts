import { createStepSpy, type StepSpy } from "@jcsoftdev/ui-core/observe/scroll-spy";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  rootOf,
} from "../internal/base.js";
import { prefersReducedMotion } from "../internal/e11.js";
import css from "./scrolly.css.js";

/** `<ui-scrolly-graphic>`: the sticky graphic; it follows the active step (see `data-step` on the host). */
export class UiScrollyGraphic extends ElementBase {}

/**
 * `<ui-scrolly-step>`: one block of the narrative. It is `role="article"`, and carries
 * `aria-current="step"` and `data-active` while it is the one the reader is on. Attribute:
 * `min-height` (any CSS length, default 70svh; a tall step gives the reader time with the graphic).
 */
export class UiScrollyStep extends ElementBase {
  static observedAttributes = ["min-height"];
  connectedCallback(): void {
    this.setAttribute("role", "article");
    this.#size();
  }
  attributeChangedCallback(): void {
    this.#size();
  }
  #size(): void {
    const height = this.getAttribute("min-height");
    if (height) this.style.minHeight = height;
    else this.style.removeProperty("min-height");
  }
}

/**
 * `<ui-scrolly>`: scrollytelling. Text steps (`<ui-scrolly-step>`) scroll past while a graphic
 * (`<ui-scrolly-graphic>`) stays in view and follows the active step: the one crossing a trigger
 * line, found with ui-core's `createStepSpy` (an IntersectionObserver, no scroll listener). Wide
 * containers put the graphic beside the steps, narrow ones pin it above them; this is a container
 * query on the element itself, so it works inside a card or a dialog. The steps are real content
 * in reading order, so it works with a screen reader and without scrolling effects.
 *
 * Attributes: `offset` (trigger line as a fraction of the scroll area, default 0.5), `root` (a CSS
 * selector for the scroll container; the page by default), `graphic-side` (`start` | `end`,
 * default `end`; mirrored in right-to-left), `graphic-height` (any CSS length), `label` (accessible
 * name), `step` (when set, the graphic shows that step and scrolling only fires `change`).
 * State on the host: `data-step`, `data-previous` and `data-reduced-motion`, plus `--ui-scrolly-step`.
 * Event: `change` with `{ step, previous }`. Members: `step`, `root` (an element, overrides the
 * attribute).
 */
export class UiScrolly extends ElementBase {
  static observedAttributes = ["offset", "root", "graphic-side", "graphic-height", "label", "step"];
  #layout = document.createElement("div");
  #observed = 0;
  #previous = 0;
  #spy: StepSpy | undefined;
  #hostObserver: MutationObserver | undefined;
  #rootOverride: Element | null | undefined;
  #motion: MediaQueryList | undefined;

  constructor() {
    super();
    this.#layout.dataset.uiPart = "layout";
  }

  get step(): number {
    const forced = this.getAttribute("step");
    return forced === null ? this.#observed : Number(forced);
  }
  set step(value: number | null) {
    if (value === null) this.removeAttribute("step");
    else this.setAttribute("step", String(value));
  }
  get root(): Element | null {
    if (this.#rootOverride !== undefined) return this.#rootOverride;
    const selector = this.getAttribute("root");
    return selector ? rootOf(this).querySelector(selector) : null;
  }
  set root(value: Element | null) {
    this.#rootOverride = value;
    if (this.isConnected) this.#observe();
  }

  connectedCallback(): void {
    this.dataset.ui = "scrolly";
    adoptStyles(rootOf(this), css);
    this.append(this.#layout);
    this.#adopt();
    this.#hostObserver = new MutationObserver((records) => {
      this.#adopt();
      if (records.some((r) => r.target === this.#layout || r.target === this)) this.#observe();
    });
    this.#hostObserver.observe(this, { childList: true });
    this.#hostObserver.observe(this.#layout, { childList: true });
    this.#motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.#motion.addEventListener("change", this.#onMotion);
    this.#observe();
  }

  disconnectedCallback(): void {
    this.#hostObserver?.disconnect();
    this.#motion?.removeEventListener("change", this.#onMotion);
    this.#spy?.destroy();
    this.#spy = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "offset" || name === "root") this.#observe();
    else this.#paint();
  }

  readonly #onMotion = (): void => this.#paint();

  #steps(): HTMLElement[] {
    return [...this.#layout.children].filter((c) => isPart(c, "scrolly-step")) as HTMLElement[];
  }

  /** Children authored after connecting land in the host; the layout owns them. */
  #adopt(): void {
    for (const child of [...this.children]) if (child !== this.#layout) this.#layout.append(child);
  }

  #observe(): void {
    this.#spy?.destroy();
    const offset = Number(this.getAttribute("offset") ?? 0.5);
    this.#spy = createStepSpy({
      steps: () => this.#steps(),
      root: this.root,
      offset: Number.isFinite(offset) ? offset : 0.5,
      onChange: (index) => this.#seen(index),
    });
    this.#paint();
  }

  #seen(index: number): void {
    if (index === this.#observed) return;
    const previous = this.#observed;
    const before = this.step;
    this.#observed = index;
    this.#previous = previous;
    this.#paint();
    emit(this, "change", { step: index, previous });
    void before;
  }

  #paint(): void {
    const steps = this.#steps();
    const step = Math.min(this.step, Math.max(0, steps.length - 1));
    const label = this.getAttribute("label");
    if (label) {
      this.setAttribute("role", "region");
      this.setAttribute("aria-label", label);
    } else {
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
    }
    this.dataset.step = String(step);
    this.dataset.previous = String(this.#previous);
    this.dataset.graphicSide = this.getAttribute("graphic-side") === "start" ? "start" : "end";
    this.toggleAttribute("data-reduced-motion", prefersReducedMotion());
    this.style.setProperty("--ui-scrolly-step", String(step));
    this.style.setProperty("--ui-scrolly-count", String(Math.max(1, steps.length)));
    const height = this.getAttribute("graphic-height");
    if (height) this.style.setProperty("--ui-scrolly-graphic-height", height);
    else this.style.removeProperty("--ui-scrolly-graphic-height");
    steps.forEach((el, i) => {
      el.toggleAttribute("data-active", i === step);
      if (i === step) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  }
}

/** Registers `<ui-scrolly>`, `<ui-scrolly-step>` and `<ui-scrolly-graphic>`; returns the scrolly tag. */
export function defineScrolly(options?: DefineOptions): string {
  defineElement("scrolly-graphic", UiScrollyGraphic, options);
  defineElement("scrolly-step", UiScrollyStep, options);
  return defineElement("scrolly", UiScrolly, options);
}
