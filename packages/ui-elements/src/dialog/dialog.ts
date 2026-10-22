import { type DefineOptions, defineElement } from "../internal/base.js";
import { ModalElement } from "../internal/modal.js";
import css from "./dialog.css.js";

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
export class UiDialog extends ModalElement {
  protected readonly ui = "dialog";
  protected readonly css = css;
}

/** Registers `<ui-dialog>` (or `<prefix-dialog>`) and returns the tag. */
export function defineDialog(options?: DefineOptions): string {
  return defineElement("dialog", UiDialog, options);
}
