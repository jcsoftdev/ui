import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { buildDisclosureShell, type DisclosureShell } from "../internal/disclosure-shell.js";
import css from "./chain-of-thought.css.js";

export type ThoughtStatus = "pending" | "active" | "done";

export interface ThoughtStep {
  id?: string;
  label: string;
  /** Plain text under the label; never parsed as markup. */
  detail?: string;
  /** `done` when omitted. */
  status?: ThoughtStatus;
}

const STATUS_TEXT: Record<ThoughtStatus, string> = {
  done: "Completed: ",
  active: "In progress: ",
  pending: "Pending: ",
};

const isStatus = (value: unknown): value is ThoughtStatus =>
  value === "pending" || value === "active" || value === "done";

function parseSteps(raw: string | null): ThoughtStep[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * `<ui-chain-of-thought>`: a collapsible list of reasoning steps with a status rail. It is the
 * WAI-ARIA disclosure pattern (ui-core `disclosure`): a header button with `aria-expanded` and
 * `aria-controls`, and a `role="region"` panel named by that button and `inert` while closed.
 *
 * Attributes: `heading` (header text, default "Reasoning"; shimmers while a step is `active`),
 * `duration` (pre-formatted total time), `open` (the state; set it to open by default), `steps`
 * (JSON array of `{ id?, label, detail?, status? }`). The `steps` property takes the same array
 * without serialising. Labels and details are rendered as text, never as markup.
 * Events: `open` and `close`, bubbling, when the state changes.
 */
export class UiChainOfThought extends ElementBase {
  static observedAttributes = ["open", "heading", "duration", "steps"];
  #shell: DisclosureShell | null = null;
  #title = document.createElement("span");
  #duration = document.createElement("span");
  #list = document.createElement("ol");
  #steps: ThoughtStep[] | null = null;

  get steps(): ThoughtStep[] {
    return this.#steps ?? parseSteps(this.getAttribute("steps"));
  }
  set steps(value: ThoughtStep[]) {
    this.#steps = Array.isArray(value) ? value : [];
    this.#renderSteps();
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    this.toggleAttribute("open", Boolean(value));
  }

  connectedCallback(): void {
    this.dataset.ui = "chain-of-thought";
    adoptStyles(rootOf(this), css);
    if (this.#shell) return;
    const shell = buildDisclosureShell(this, "thought");
    this.#shell = shell;
    this.#title.dataset.uiPart = "title";
    this.#duration.dataset.uiPart = "duration";
    this.#list.dataset.uiPart = "list";
    shell.header.append(this.#title, this.#duration);
    shell.body.append(this.#list);
    this.#renderHeader();
    this.#renderSteps();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#shell) return;
    if (name === "open") this.#shell.sync();
    else if (name === "steps") {
      this.#steps = null;
      this.#renderSteps();
    } else this.#renderHeader();
  }

  #renderHeader(): void {
    const active = this.steps.some((step) => step?.status === "active");
    const heading = this.getAttribute("heading") ?? "Reasoning";
    this.#title.textContent = active ? `${heading}…` : heading;
    this.#title.toggleAttribute("data-active", active);
    if (active) this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
    const duration = this.getAttribute("duration");
    this.#duration.textContent = duration ?? "";
    this.#duration.hidden = !duration;
  }

  #renderSteps(): void {
    if (!this.#shell) return;
    const steps = this.steps;
    this.#list.replaceChildren(
      ...steps.map((raw, index) => {
        const step = raw ?? ({} as ThoughtStep);
        const status: ThoughtStatus = isStatus(step.status) ? step.status : "done";
        const item = document.createElement("li");
        item.dataset.status = status;
        if (step.id) item.dataset.id = String(step.id);
        const marker = document.createElement("span");
        marker.dataset.uiPart = "marker";
        marker.setAttribute("aria-hidden", "true");
        const text = document.createElement("div");
        text.dataset.uiPart = "text";
        const label = document.createElement("p");
        label.dataset.uiPart = "label";
        const hidden = document.createElement("span");
        hidden.dataset.uiPart = "status";
        hidden.textContent = STATUS_TEXT[status];
        label.append(hidden, document.createTextNode(String(step.label ?? "")));
        text.append(label);
        if (step.detail) {
          const detail = document.createElement("div");
          detail.dataset.uiPart = "detail";
          detail.textContent = String(step.detail);
          text.append(detail);
        }
        item.append(marker, text);
        item.dataset.index = String(index);
        return item;
      }),
    );
    this.#renderHeader();
  }
}

/** Registers `<ui-chain-of-thought>` (or `<prefix-chain-of-thought>`) and returns the tag. */
export function defineChainOfThought(options?: DefineOptions): string {
  return defineElement("chain-of-thought", UiChainOfThought, options);
}
