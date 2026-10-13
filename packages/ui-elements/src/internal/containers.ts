import { adoptStyles, rootOf } from "./base.js";

/**
 * Marks a light-DOM container element (`data-ui`) and adopts its CSS into the root node it lives
 * in. Container CSS is keyed on `[data-ui="<name>"]`, so it applies under any tag prefix.
 */
export function connectLight(host: HTMLElement, ui: string, css: string): void {
  host.dataset.ui = ui;
  adoptStyles(rootOf(host), css);
}

/** Sets `name` on `element` only when the author has not set it. */
export function defaultAttr(element: Element, name: string, value: string): void {
  if (!element.hasAttribute(name)) element.setAttribute(name, value);
}

/**
 * The row layout shared by `<ui-settings-row>` and `<ui-cell>`: a body block (title, optional
 * description) in front of the author's children, which are the row's controls.
 */
export class RowParts {
  readonly body = document.createElement("div");
  readonly title = document.createElement("p");
  readonly description = document.createElement("p");

  constructor(private readonly host: HTMLElement) {
    this.body.dataset.uiPart = "body";
    this.title.dataset.uiPart = "title";
    this.description.dataset.uiPart = "description";
  }

  /** Id of the title element, for the `aria-labelledby` of a control. */
  get titleId(): string {
    return this.title.id;
  }

  /** Builds the body once (idempotent) and reflects `heading` / `description` into it. */
  render(titleId: string): void {
    if (!this.title.id) this.title.id = titleId;
    if (!this.body.isConnected) {
      this.body.append(this.title);
      this.host.prepend(this.body);
    } else if (this.host.firstChild !== this.body) {
      this.host.prepend(this.body);
    }
    this.title.textContent = this.host.getAttribute("heading") ?? "";
    const description = this.host.getAttribute("description");
    this.description.textContent = description ?? "";
    if (description) this.body.append(this.description);
    else this.description.remove();
  }
}
