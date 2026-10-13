import { lockScroll } from "@jcsoftdev/ui-core/scroll-lock";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  ensureId,
  onCommand,
  rootOf,
} from "../internal/base.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./dialog.css.js";

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/**
 * `<ui-dialog>`: a modal dialog on the native `<dialog>` (`showModal()`: top layer, inert page,
 * focus moved in and returned). Light DOM: the children move into the dialog panel on first
 * connect. Parts by attribute: `data-dialog-title` and `data-dialog-description` (wired to
 * `aria-labelledby` / `aria-describedby`), `data-dialog-header`, `data-dialog-body`,
 * `data-dialog-footer`, and `data-dialog-close` on anything that should close it.
 *
 * Attributes: `open`, `blocking` (no Escape, no backdrop dismiss, no close button), `width`
 * (md | lg), `close-label`, `material` and the `liquid-*` options. Open it with `show()`, the
 * `open` attribute or an invoker: `<button commandfor="id" command="--open">` (`--close`,
 * `--toggle`). Fires `open`, `close` and a cancelable `cancel` (Escape, backdrop, close button).
 */
export class UiDialog extends ElementBase {
  static observedAttributes = ["open", "blocking", "close-label", ...MATERIAL_ATTRIBUTES];

  #panel: HTMLDialogElement | undefined;
  #close: HTMLButtonElement | undefined;
  #material = new Material(this, () => this.#panel ?? null);
  #unlock: (() => void) | undefined;
  #fallback: (() => void) | undefined;
  #pressedBackdrop = false;
  #shown = false;
  /** Native `close` events still queued from our own `panel.close()` calls. */
  #ownCloses = 0;
  #returnFocus: HTMLElement | null = null;

  constructor() {
    super();
    onCommand(this, (command) => {
      if (command === "--open") this.show();
      else if (command === "--close") this.close();
      else if (command === "--toggle") this.toggle();
    });
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    this.toggleAttribute("open", value);
  }
  get panel(): HTMLDialogElement | undefined {
    return this.#panel;
  }

  show(): void {
    this.open = true;
  }
  close(): void {
    this.open = false;
  }
  toggle(): void {
    this.open = !this.open;
  }

  connectedCallback(): void {
    this.dataset.ui = "dialog";
    adoptStyles(rootOf(this), css);
    this.#panel ??= this.#build();
    this.#sync();
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#hide(false);
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#panel) return;
    if (name === "open") this.#sync();
    else if (name === "blocking" || name === "close-label") this.#renderClose();
    else this.#material.sync();
  }

  #build(): HTMLDialogElement {
    const panel = document.createElement("dialog");
    panel.dataset.uiPart = "panel";
    this.append(panel);
    this.#adopt(panel);
    // Only the panel's own events: a nested dialog's or overlay's `cancel`/`close` bubble here too.
    panel.addEventListener("cancel", (event) => {
      if (event.target !== panel) return;
      event.preventDefault();
      this.#requestClose();
    });
    // A native close (form method=dialog, a close command, a forced Escape) keeps the state in step.
    panel.addEventListener("close", (event) => {
      if (event.target !== panel) return;
      if (this.#ownCloses > 0) {
        this.#ownCloses--;
        return;
      }
      if (!this.#shown) return;
      this.open = false;
      this.#hide(true);
    });
    panel.addEventListener("pointerdown", (event) => {
      this.#pressedBackdrop = this.#onBackdrop(event);
    });
    panel.addEventListener("click", (event) => {
      const backdrop = this.#pressedBackdrop && this.#onBackdrop(event);
      this.#pressedBackdrop = false;
      if (backdrop) return this.#requestClose();
      const closer = (event.target as Element).closest("[data-dialog-close]");
      if (closer && closer.closest("dialog") === panel) this.#requestClose(true);
    });
    this.#renderClose(panel);
    return panel;
  }

  /**
   * Moves the host's other children into the panel and wires the title and description. Runs on
   * build and before every show, so children parsed after the element upgraded are not missed.
   */
  #adopt(panel: HTMLDialogElement): void {
    const strays = [...this.childNodes].filter((node) => node !== panel);
    if (strays.length) panel.prepend(...strays);
    const title = panel.querySelector("[data-dialog-title]");
    const description = panel.querySelector("[data-dialog-description]");
    if (title) panel.setAttribute("aria-labelledby", ensureId(title, "dialog-title"));
    if (description)
      panel.setAttribute("aria-describedby", ensureId(description, "dialog-description"));
  }

  #renderClose(panel = this.#panel): void {
    if (!panel) return;
    if (this.hasAttribute("blocking")) {
      this.#close?.remove();
      this.#close = undefined;
      return;
    }
    if (!this.#close) {
      this.#close = document.createElement("button");
      this.#close.type = "button";
      this.#close.dataset.uiPart = "close";
      this.#close.dataset.dialogClose = "";
      this.#close.innerHTML = CLOSE_ICON;
    }
    this.#close.setAttribute("aria-label", this.getAttribute("close-label") ?? "Close");
    if (!this.#close.isConnected) panel.append(this.#close);
  }

  /** A press on the backdrop: on the dialog element itself, outside its box. */
  #onBackdrop(event: MouseEvent): boolean {
    if (event.target !== this.#panel || !this.#panel) return false;
    const box = this.#panel.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
  }

  /** Escape, the backdrop and close buttons: `cancel` can veto, `blocking` vetoes the first two. */
  #requestClose(explicit = false): void {
    if (!explicit && this.hasAttribute("blocking")) return;
    if (emit(this, "cancel", undefined, true)) this.close();
  }

  #sync(): void {
    const panel = this.#panel;
    if (!panel) return;
    if (this.open && this.isConnected && !this.#shown) {
      this.#adopt(panel);
      this.#returnFocus = document.activeElement as HTMLElement | null;
      if (typeof panel.showModal === "function") panel.showModal();
      else this.#showFallback(panel);
      this.#shown = true;
      this.#unlock = lockScroll();
      emit(this, "open");
    } else if (!this.open && this.#shown) {
      this.#hide(true);
    }
  }

  #hide(notify: boolean): void {
    const panel = this.#panel;
    if (!panel || !this.#shown) return;
    this.#shown = false;
    if (panel.open) {
      this.#ownCloses++;
      panel.close();
    }
    this.#fallback?.();
    this.#fallback = undefined;
    this.#unlock?.();
    this.#unlock = undefined;
    if (this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    this.#returnFocus = null;
    if (notify) emit(this, "close");
  }

  /** Engines without `showModal()`: an `open` dialog with ui-core's focus trap and dismiss layer. */
  #showFallback(panel: HTMLDialogElement): void {
    panel.setAttribute("open", "");
    panel.dataset.uiFallback = "";
    let stopped = false;
    const stops: (() => void)[] = [];
    this.#fallback = () => {
      stopped = true;
      for (const stop of stops) stop();
      panel.removeAttribute("open");
    };
    Promise.all([import("@jcsoftdev/ui-core/focus"), import("@jcsoftdev/ui-core/dismiss")]).then(
      ([{ createFocusScope }, { createDismissLayer }]) => {
        if (stopped) return;
        stops.push(createFocusScope(panel, { onUnmountAutoFocus: (e) => e.preventDefault() }));
        stops.push(createDismissLayer(panel, { onDismiss: () => this.#requestClose() }));
      },
    );
  }
}

/** Registers `<ui-dialog>` (or `<prefix-dialog>`) and returns the tag. */
export function defineDialog(options?: DefineOptions): string {
  return defineElement("dialog", UiDialog, options);
}
