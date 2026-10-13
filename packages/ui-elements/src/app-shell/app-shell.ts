import { observeResize } from "@jcsoftdev/ui-core/observe/resize";
import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  toggleAttr,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { SHELL_BREAKPOINT } from "../internal/e8-shell.js";
import css from "./app-shell.css.js";

/**
 * `<ui-app-shell>`: the root of the app frame (`<ui-sidebar>` + `<ui-topbar>` + the page). Layout
 * only, so it has no role. It is an inline-size query container named `page`
 * (`container: page / inline-size`): the sidebar turns into a drawer and the topbar shows its menu
 * button when the SHELL is narrower than 900 px, whatever the viewport is, and the layout
 * elements (`ui-cols`, `ui-settings-layout`, ...) answer to the same `@container page (...)`.
 *
 * Reflects `data-compact` while the shell is narrower than 900 px. Fires `compact-change`
 * (`detail: { compact }`) when that flips. The `compact` property reads the live state.
 */
export class UiAppShell extends ElementBase {
  #stop: (() => void) | undefined;
  #last = false;

  get compact(): boolean {
    return this.getBoundingClientRect().width < SHELL_BREAKPOINT;
  }

  connectedCallback(): void {
    connectLight(this, "app-shell", css);
    this.#stop = observeResize(this, () => this.#measure());
  }

  disconnectedCallback(): void {
    this.#stop?.();
    this.#stop = undefined;
  }

  #measure(): void {
    const compact = this.compact;
    toggleAttr(this, "data-compact", compact);
    if (compact === this.#last) return;
    this.#last = compact;
    emit(this, "compact-change", { compact });
  }
}

/** Registers `<ui-app-shell>` (or `<prefix-app-shell>`) and returns the tag. */
export function defineAppShell(options?: DefineOptions): string {
  return defineElement("app-shell", UiAppShell, options);
}
