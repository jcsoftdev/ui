import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { codeNode } from "../internal/code-node.js";
import { buildDisclosureShell, type DisclosureShell } from "../internal/disclosure-shell.js";
import css from "./tool-call.css.js";

export type ToolCallStatus = "pending" | "running" | "done" | "error";

const STATUS_LABELS: Record<ToolCallStatus, string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  error: "Error",
};

const pretty = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * `<ui-tool-call>`: a collapsible tool invocation with a status, JSON arguments and a JSON result.
 * It is the WAI-ARIA disclosure pattern (ui-core `disclosure`): a header button with
 * `aria-expanded` and `aria-controls`, and a `role="region"` panel named by that button and
 * `inert` while closed. The arguments and the result are `<section aria-label>` landmarks-free
 * groups; an error is a `role="alert"` paragraph.
 *
 * Attributes: `name` (tool identifier), `status` (`pending` default, `running`, `done`, `error`),
 * `duration` (pre-formatted), `error` (shown when `status="error"`), `open` (the state),
 * `args` and `result` (text shown as is). The `args` and `result` properties take any value and
 * show it as formatted JSON. If `<prefix-code-block>` is defined it renders the code, otherwise a
 * plain `<pre>`. Everything is text, never markup.
 * Events: `open` and `close`, bubbling, when the state changes.
 */
export class UiToolCall extends ElementBase {
  static observedAttributes = ["open", "name", "status", "duration", "error", "args", "result"];
  #shell: DisclosureShell | null = null;
  #name = document.createElement("span");
  #status = document.createElement("span");
  #statusText = document.createElement("span");
  #duration = document.createElement("span");
  #error = document.createElement("p");
  #args: unknown;
  #result: unknown;
  #argsSet = false;
  #resultSet = false;

  get args(): unknown {
    return this.#argsSet ? this.#args : (this.getAttribute("args") ?? undefined);
  }
  set args(value: unknown) {
    this.#args = value;
    this.#argsSet = true;
    this.#renderBody();
  }
  get result(): unknown {
    return this.#resultSet ? this.#result : (this.getAttribute("result") ?? undefined);
  }
  set result(value: unknown) {
    this.#result = value;
    this.#resultSet = true;
    this.#renderBody();
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    this.toggleAttribute("open", Boolean(value));
  }

  connectedCallback(): void {
    this.dataset.ui = "tool-call";
    adoptStyles(rootOf(this), css);
    if (this.#shell) return;
    const shell = buildDisclosureShell(this, "tool");
    this.#shell = shell;
    this.#name.dataset.uiPart = "name";
    this.#status.dataset.uiPart = "status";
    this.#statusText.dataset.uiPart = "status-text";
    this.#duration.dataset.uiPart = "duration";
    this.#error.dataset.uiPart = "error";
    this.#error.setAttribute("role", "alert");
    const icon = document.createElement("span");
    icon.dataset.uiPart = "status-icon";
    icon.setAttribute("aria-hidden", "true");
    this.#status.append(icon, this.#statusText, this.#duration);
    shell.header.append(this.#name, this.#status);
    this.#renderHeader();
    this.#renderBody();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#shell) return;
    if (name === "open") this.#shell.sync();
    else if (name === "args" || name === "result" || name === "error") this.#renderBody();
    else this.#renderHeader();
  }

  get #state(): ToolCallStatus {
    const status = this.getAttribute("status");
    return status && status in STATUS_LABELS ? (status as ToolCallStatus) : "pending";
  }

  #renderHeader(): void {
    const status = this.#state;
    this.dataset.status = status;
    this.#name.textContent = this.getAttribute("name") ?? "";
    this.#statusText.textContent = STATUS_LABELS[status];
    const duration = this.getAttribute("duration");
    this.#duration.textContent = duration ? `· ${duration}` : "";
    this.#duration.hidden = !duration;
    if (status === "running") this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
    this.#renderBody();
  }

  #section(label: string, value: unknown): HTMLElement {
    const section = document.createElement("section");
    section.dataset.uiPart = "section";
    section.setAttribute("aria-label", label);
    const title = document.createElement("h4");
    title.dataset.uiPart = "section-title";
    title.textContent = label;
    section.append(title, codeNode(this, "tool-call", pretty(value), "json"));
    return section;
  }

  #renderBody(): void {
    if (!this.#shell) return;
    const parts: HTMLElement[] = [];
    const { args, result } = this;
    if (args !== undefined) parts.push(this.#section("Arguments", args));
    const error = this.getAttribute("error");
    if (this.#state === "error" && error) {
      this.#error.textContent = error;
      parts.push(this.#error);
    }
    if (result !== undefined) parts.push(this.#section("Result", result));
    this.#shell.body.replaceChildren(...parts);
  }
}

/** Registers `<ui-tool-call>` (or `<prefix-tool-call>`) and returns the tag. */
export function defineToolCall(options?: DefineOptions): string {
  return defineElement("tool-call", UiToolCall, options);
}
