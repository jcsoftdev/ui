import { lockScroll } from "@jcsoftdev/ui-core/scroll-lock";
import { adoptStyles, ElementBase, emit, ensureId, onCommand, rootOf } from "./base.js";
import { MATERIAL_ATTRIBUTES, Material } from "./material.js";

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/**
 * The modal on the native `<dialog>` that `<ui-dialog>` and `<ui-drawer>` share: `showModal()` (top
 * layer, inert page, focus moved in and returned), scroll lock from ui-core, `open` / `blocking` /
 * `close-label`, Escape, backdrop and close-button dismissal through a cancelable `cancel` event,
 * invoker commands and the optional liquid material. A subclass names itself (`ui`), supplies its
 * CSS and may hook the panel (`built`, `shown`) and delay the close for an exit effect (`exit`).
 */
export abstract class ModalElement extends ElementBase {
  static observedAttributes = ["open", "blocking", "close-label", ...MATERIAL_ATTRIBUTES];

  /** The `data-ui` value and the prefix of the part attributes (`data-<ui>-title`, `-close`...). */
  protected abstract readonly ui: string;
  protected abstract readonly css: string;

  #panel: HTMLDialogElement | undefined;
  #close: HTMLButtonElement | undefined;
  #material = new Material(this, () => this.#panel ?? null);
  #unlock: (() => void) | undefined;
  #fallback: (() => void) | undefined;
  #pressedBackdrop = false;
  #shown = false;
  /** Cancels the exit effect of a close that has not finished yet. */
  #exiting: { cancel: () => void; finish: () => void } | undefined;
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

  /** The panel was created (once, on first connect): add parts and listeners. */
  protected built(_panel: HTMLDialogElement): void {}
  /** The panel was shown (or reopened during an exit effect). */
  protected shown(_panel: HTMLDialogElement): void {}
  /**
   * The panel is closing. Return a cancel function after scheduling `done` for when an exit effect
   * has finished; return nothing to close at once. Called with the closed state already applied
   * (`open` is false); `done` closes the native dialog and returns focus.
   */
  protected exit(_panel: HTMLDialogElement, _done: () => void): (() => void) | undefined {
    return undefined;
  }

  connectedCallback(): void {
    this.dataset.ui = this.ui;
    adoptStyles(rootOf(this), this.css);
    this.#panel ??= this.#build();
    this.#sync();
    this.#material.sync();
  }

  disconnectedCallback(): void {
    const exiting = this.#exiting;
    exiting?.cancel();
    exiting?.finish();
    this.#hide(false, true);
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
      const closer = (event.target as Element).closest(`[data-${this.ui}-close]`);
      if (closer && closer.closest("dialog") === panel) this.#requestClose(true);
    });
    this.#renderClose(panel);
    this.built(panel);
    return panel;
  }

  /**
   * Moves the host's other children into the panel and wires the title and description. Runs on
   * build and before every show, so children parsed after the element upgraded are not missed.
   */
  #adopt(panel: HTMLDialogElement): void {
    const strays = [...this.childNodes].filter((node) => node !== panel);
    if (strays.length) panel.prepend(...strays);
    const title = panel.querySelector(`[data-${this.ui}-title]`);
    const description = panel.querySelector(`[data-${this.ui}-description]`);
    if (title) panel.setAttribute("aria-labelledby", ensureId(title, `${this.ui}-title`));
    if (description)
      panel.setAttribute("aria-describedby", ensureId(description, `${this.ui}-description`));
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
      this.#close.setAttribute(`data-${this.ui}-close`, "");
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
    if (!this.open) return;
    if (!explicit && this.hasAttribute("blocking")) return;
    if (emit(this, "cancel", undefined, true)) this.close();
  }

  /** Dismiss like Escape or the backdrop would (a cancelable `cancel` first); for subclasses. */
  protected requestDismiss(): void {
    this.#requestClose();
  }

  #sync(): void {
    const panel = this.#panel;
    if (!panel) return;
    if (this.open && this.isConnected && !this.#shown) {
      this.#adopt(panel);
      // Reopened while the exit effect of the last close still runs: the panel is still modal.
      const resumed = this.#exiting !== undefined;
      this.#exiting?.cancel();
      this.#exiting = undefined;
      panel.inert = false;
      if (!resumed) this.#returnFocus = document.activeElement as HTMLElement | null;
      if (!panel.open) {
        if (typeof panel.showModal === "function") panel.showModal();
        else this.#showFallback(panel);
      }
      this.#shown = true;
      this.#unlock ??= lockScroll();
      this.shown(panel);
      emit(this, "open");
    } else if (!this.open && this.#shown) {
      this.#hide(true);
    }
  }

  #hide(notify: boolean, immediate = false): void {
    const panel = this.#panel;
    if (!panel || !this.#shown) return;
    this.#shown = false;
    let finished = false;
    const finish = () => {
      finished = true;
      this.#exiting = undefined;
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
      panel.inert = false;
      // After the focus is back, so a `close` handler that moves focus has the last word.
      if (notify) emit(this, "close");
    };
    const cancel = immediate ? undefined : this.exit(panel, finish);
    if (!cancel) finish();
    else if (!finished) {
      // The panel is only animating out: nothing in it takes focus or presses meanwhile.
      panel.inert = true;
      this.#exiting = { cancel, finish };
    }
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
