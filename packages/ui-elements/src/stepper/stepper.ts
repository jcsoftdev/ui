import {
  type DefineOptions,
  defineElement,
  ElementBase,
  isPart,
  toggleAttr,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./stepper.css.js";

/**
 * `<ui-step value="id">Label</ui-step>`: one step of a `<ui-stepper>`. The element wraps its
 * children into a numbered marker and a label. Attribute: `value` (the step id).
 */
export class UiStep extends ElementBase {
  static observedAttributes = ["value"];
  #owner: Element | null = null;
  readonly marker = document.createElement("span");
  readonly content = document.createElement("span");
  readonly #label = document.createElement("span");
  #late: MutationObserver | undefined;

  connectedCallback(): void {
    if (!this.content.isConnected) {
      this.#label.dataset.uiPart = "label";
      this.#label.append(...this.childNodes);
      this.marker.dataset.uiPart = "marker";
      this.content.dataset.uiPart = "content";
      this.content.append(this.marker, this.#label);
      this.append(this.content);
      this.#late = new MutationObserver(() => {
        for (const node of [...this.childNodes])
          if (node !== this.content) this.#label.append(node);
      });
      this.#late.observe(this, { childList: true });
    }
    this.setAttribute("role", "listitem");
    this.#notify();
  }

  disconnectedCallback(): void {
    this.#owner?.dispatchEvent(new Event("ui-stepper-change"));
    this.#owner = null;
  }

  attributeChangedCallback(): void {
    this.#notify();
  }

  #notify(): void {
    this.#owner = this.closest(this.localName.replace(/-step$/, "-stepper")) ?? this.#owner;
    this.#owner?.dispatchEvent(new Event("ui-stepper-change"));
  }
}

/**
 * `<ui-stepper current="id">`: a step 1-N indicator for multi-stage flows. A list (`role="list"`)
 * of `<ui-step value>`; the current step carries `aria-current="step"` on its content. It is an
 * inline-size query container named `stepper`: under 420 px only the current label is shown, the
 * others stay for assistive technology. Name it with `aria-label`.
 *
 * Attributes: `current` (the `value` of the current step; React `currentStepId`).
 */
export class UiStepper extends ElementBase {
  static observedAttributes = ["current"];
  #steps: MutationObserver | undefined;

  constructor() {
    super();
    this.addEventListener("ui-stepper-change", () => this.#render());
  }

  get current(): string | null {
    return this.getAttribute("current");
  }
  set current(value: string | null) {
    if (value === null) this.removeAttribute("current");
    else this.setAttribute("current", value);
  }

  connectedCallback(): void {
    connectLight(this, "stepper", css);
    this.setAttribute("role", "list");
    this.#render();
    this.#steps = new MutationObserver(() => this.#render());
    this.#steps.observe(this, { childList: true });
  }

  disconnectedCallback(): void {
    this.#steps?.disconnect();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const steps = [...this.children].filter((child): child is UiStep => isPart(child, "step"));
    steps.forEach((step, index) => {
      const current = step.getAttribute("value") === this.current;
      const content = step.querySelector<HTMLElement>(":scope > [data-ui-part='content']");
      const marker = content?.firstElementChild;
      if (marker) marker.textContent = String(index + 1);
      toggleAttr(step, "data-current", current);
      if (current) content?.setAttribute("aria-current", "step");
      else content?.removeAttribute("aria-current");
    });
  }
}

/** Registers `<ui-stepper>` and `<ui-step>` (or the prefixed tags); returns the stepper tag. */
export function defineStepper(options?: DefineOptions): string {
  const tag = defineElement("stepper", UiStepper, options);
  defineElement("step", UiStep, options);
  return tag;
}
