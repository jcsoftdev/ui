import { type DefineOptions, defineElement, ElementBase, emit, uid } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { part } from "../internal/e10.js";
import css from "./confirm-action.css.js";

/** What a confirm handler may return: nothing, or a result that keeps the step open with a message. */
export type ConfirmResult = { ok: true } | { ok: false; error: string };

type ConfirmHandler = () => Promise<ConfirmResult> | Promise<void> | ConfirmResult | undefined;

/**
 * `<ui-confirm-action>`: an inline two-step confirmation for a destructive action, with no modal
 * and no lost context. It shows one trigger button (`label`); activating it swaps the button for
 * the `consequence` text with a danger Confirm button and a Cancel button.
 *
 * ARIA: the second step is a `<fieldset>` named by a visually hidden `<legend>` (the label) and
 * described by the consequence. Focus moves to Cancel (the safe choice) when the step opens and
 * returns to the trigger when it closes. While the handler runs the Confirm button is
 * `aria-busy` and shows a spinner with the `processing-label`; Cancel is disabled. A failure is a
 * `role="alert"` message and the step stays open.
 *
 * Set `onConfirm` (a property) to the action: it may return a promise, may return
 * `{ ok: false, error }` and may throw. Either failure shows the error (or `failure-message`).
 * Attributes: `label`, `consequence`, `confirm-label` ("Confirm"), `cancel-label` ("Cancel"),
 * `processing-label` ("Processing…"), `failure-message` ("The action could not be completed. Try
 * again."), `trigger-variant` (`secondary` default, `primary`, `ghost`, `danger`).
 * Events (bubble): `open` when the step opens, `cancel` when it is cancelled, `confirm` when the
 * action succeeded and `failed` (`detail.message`) when it failed.
 */
export class UiConfirmAction extends ElementBase {
  static observedAttributes = [
    "label",
    "consequence",
    "confirm-label",
    "cancel-label",
    "processing-label",
    "trigger-variant",
  ];

  /** The action to run on confirm. */
  onConfirm: ConfirmHandler | undefined;

  #confirming = false;
  #busy = false;
  #failure: string | null = null;
  #wasConfirming = false;
  #focus: "cancel" | "confirm" = "cancel";

  connectedCallback(): void {
    connectLight(this, "confirm-action", css);
    this.#render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  /** Whether the second step (consequence, Confirm, Cancel) is showing. */
  get confirming(): boolean {
    return this.#confirming;
  }

  /** Opens the second step, as the trigger does. */
  open(): void {
    if (this.#confirming) return;
    this.#confirming = true;
    this.#focus = "cancel";
    emit(this, "open");
    this.#render();
  }

  /** Closes the second step without running the action. */
  cancel(): void {
    if (!this.#confirming || this.#busy) return;
    this.#confirming = false;
    emit(this, "cancel");
    this.#render();
  }

  async #confirm(): Promise<void> {
    if (this.#busy) return;
    this.#focus = "confirm";
    this.#busy = true;
    this.#failure = null;
    this.#render();
    let failure: string | null = null;
    try {
      const result = await this.onConfirm?.();
      if (result && !result.ok) failure = result.error;
    } catch {
      failure =
        this.getAttribute("failure-message") ?? "The action could not be completed. Try again.";
    }
    this.#busy = false;
    if (failure === null) {
      this.#confirming = false;
      emit(this, "confirm");
    } else {
      this.#failure = failure;
      emit(this, "failed", { message: failure });
    }
    this.#render();
  }

  #button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
    const button = part("button", variant);
    button.type = "button";
    button.dataset.variant = variant;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  #banner(message: string): HTMLElement {
    const banner = part("div", "error", message);
    banner.setAttribute("role", "alert");
    return banner;
  }

  #render(): void {
    const label = this.getAttribute("label") ?? "";
    const restoreFocus = this.#wasConfirming && !this.#confirming;
    this.#wasConfirming = this.#confirming;
    if (!this.#confirming) {
      const trigger = this.#button(label, "trigger", () => this.open());
      trigger.dataset.variant = this.getAttribute("trigger-variant") ?? "secondary";
      this.replaceChildren(
        ...(this.#failure === null ? [] : [this.#banner(this.#failure)]),
        trigger,
      );
      if (restoreFocus) trigger.focus();
      return;
    }
    const fieldset = part("fieldset", "step");
    const legend = part("legend", "legend", label);
    const consequence = part("p", "consequence", this.getAttribute("consequence") ?? "");
    consequence.id = uid("confirm-consequence");
    fieldset.setAttribute("aria-describedby", consequence.id);
    const actions = part("div", "actions");
    const confirm = this.#button(
      this.getAttribute("confirm-label") ?? "Confirm",
      "danger",
      () => void this.#confirm(),
    );
    if (this.#busy) {
      const processing = this.getAttribute("processing-label") ?? "Processing…";
      confirm.setAttribute("aria-busy", "true");
      confirm.setAttribute("aria-disabled", "true");
      confirm.replaceChildren(part("span", "spinner"), part("span", "sr", processing));
      confirm.insertAdjacentText("beforeend", this.getAttribute("confirm-label") ?? "Confirm");
    }
    const cancel = this.#button(this.getAttribute("cancel-label") ?? "Cancel", "secondary", () =>
      this.cancel(),
    );
    cancel.disabled = this.#busy;
    actions.append(confirm, cancel);
    fieldset.append(
      legend,
      consequence,
      ...(this.#failure === null ? [] : [this.#banner(this.#failure)]),
      actions,
    );
    this.replaceChildren(fieldset);
    (this.#focus === "confirm" ? confirm : cancel).focus();
  }
}

/** Registers `<ui-confirm-action>` (or the same under another prefix) and returns its tag. */
export function defineConfirmAction(options?: DefineOptions): string {
  return defineElement("confirm-action", UiConfirmAction, options);
}
