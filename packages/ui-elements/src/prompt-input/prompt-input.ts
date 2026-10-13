import { observeResize } from "@jcsoftdev/ui-core/observe/resize";
import { adoptStyles, type DefineOptions, defineElement, emit } from "../internal/base.js";
import { chatGlyph, numberAttr } from "../internal/chat.js";
import { FormElement } from "../internal/form.js";
import { innerValidity, syncControlAria } from "../internal/form-controls.js";
import css from "./prompt-input.css.js";

/** Enter submits; Shift+Enter inserts a newline; IME composition never submits. */
export interface SubmitKeyEvent {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode?: number;
}

/**
 * Whether a keydown should send the message. `isComposing` covers browsers that keep the flag
 * through the confirming Enter, `keyCode === 229` the ones that report "processing" instead.
 */
export function shouldSend(event: SubmitKeyEvent): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

/** Safari fires the confirming Enter after `compositionend`; this window swallows it. */
const COMPOSITION_END_GRACE_MS = 50;

/**
 * `<ui-prompt-input>`: a chat composer on the `FormElement` base: an autosizing `<textarea>` in a
 * shadow root (focus is delegated to it), a send button that becomes a stop button while a
 * response streams, and slots for attachments (`slot="attachments"`, for `<ui-attachment>`s),
 * actions (`slot="actions"`, left of the send button) and a hint line (`slot="hint"`).
 *
 * Keyboard: Enter sends, Shift+Enter inserts a newline, and Enter that confirms an IME composition
 * never sends (`isComposing`, keyCode 229 and a short grace window after `compositionend`).
 * Sending fires `send` ({ value }, trimmed; never fired when empty, disabled or streaming) and then
 * clears the field unless the event is cancelled. The stop button fires `stop`. Pasting files
 * fires `attach` ({ files }) so the page can add `<ui-attachment>` children.
 *
 * Form: submits its draft under `name`, restores the `value` attribute on `form.reset()`, follows a
 * disabled fieldset and `required`. Accessible name: `aria-label`, `label` or an associated
 * `<label>`, else "Mensaje".
 *
 * Attributes: `value`, `name`, `disabled`, `required`, `placeholder`, `label`, `streaming` (React
 * `streaming`), `max-rows` (rows before the field scrolls, default 6), `send-label`, `stop-label`.
 * Events: `input`, `change`, `send` (React `onSubmit`), `stop` (`onStop`), `attach`.
 */
export class UiPromptInput extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "placeholder",
    "label",
    "aria-label",
    "streaming",
    "max-rows",
    "send-label",
    "stop-label",
    "invalid",
  ];

  readonly #area: HTMLTextAreaElement;
  readonly #send: HTMLButtonElement;
  readonly #stop: HTMLButtonElement;
  readonly #attachments: HTMLElement;
  readonly #hint: HTMLElement;
  #composing = false;
  #composedAt = Number.NEGATIVE_INFINITY;
  #width = -1;
  #stopObserving: (() => void) | undefined;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = `<div part="box"><div part="attachments" hidden><slot name="attachments"></slot></div><textarea part="textarea" rows="1"></textarea><div part="toolbar"><div part="actions"><slot name="actions"></slot></div><button part="send" type="button" disabled>${chatGlyph("up")}</button><button part="stop" type="button" hidden>${chatGlyph("stop")}</button></div></div><p part="hint" hidden><slot name="hint"></slot></p>`;
    this.#area = root.querySelector("textarea") as HTMLTextAreaElement;
    this.#send = root.querySelector("[part=send]") as HTMLButtonElement;
    this.#stop = root.querySelector("[part=stop]") as HTMLButtonElement;
    this.#attachments = root.querySelector("[part=attachments]") as HTMLElement;
    this.#hint = root.querySelector("[part=hint]") as HTMLElement;

    this.#area.addEventListener("input", () => {
      this.value = this.#area.value;
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    });
    this.#area.addEventListener("change", () => emit(this, "change"));
    this.#area.addEventListener("compositionstart", () => {
      this.#composing = true;
    });
    this.#area.addEventListener("compositionend", (event) => {
      this.#composing = false;
      this.#composedAt = event.timeStamp;
    });
    this.#area.addEventListener("keydown", (event) => {
      const composing =
        this.#composing || event.timeStamp - this.#composedAt < COMPOSITION_END_GRACE_MS;
      if (!shouldSend(event) || composing) return;
      event.preventDefault();
      this.#submit();
    });
    this.#area.addEventListener("paste", (event) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length) emit(this, "attach", { files });
    });
    this.#send.addEventListener("click", () => this.#submit());
    this.#stop.addEventListener("click", () => emit(this, "stop"));
    root.addEventListener("slotchange", () => this.#syncSlots());
  }

  get streaming(): boolean {
    return this.hasAttribute("streaming");
  }
  set streaming(value: boolean) {
    this.toggleAttribute("streaming", value);
  }
  /** The inner native textarea, for selection and focus APIs. */
  get textarea(): HTMLTextAreaElement {
    return this.#area;
  }

  /** Sends the trimmed draft (the same as pressing Enter). */
  submit(): void {
    this.#submit();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopObserving = observeResize(this.#area, (rect) => {
      if (Math.round(rect.width) === this.#width) return;
      this.#width = Math.round(rect.width);
      this.#autosize();
    });
    this.#syncSlots();
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#stopObserving?.();
    this.#stopObserving = undefined;
  }

  #submit(): void {
    const text = this.value.trim();
    if (!text || this.disabled || this.streaming) return;
    const proceed = emit(this, "send", { value: text }, true);
    if (proceed) this.commit("");
  }

  #syncSlots(): void {
    const filled = (slot: string) =>
      (
        this.shadowRoot?.querySelector(`slot[name=${slot}]`) as HTMLSlotElement | null
      )?.assignedNodes().length;
    this.#attachments.hidden = !filled("attachments");
    this.#hint.hidden = !filled("hint");
  }

  #autosize(): void {
    const area = this.#area;
    area.style.height = "auto";
    const line = Number.parseFloat(getComputedStyle(area).lineHeight) || 20;
    const max = line * (numberAttr(this, "max-rows") ?? 6);
    area.style.height = `${Math.min(area.scrollHeight, max)}px`;
    area.style.overflowY = area.scrollHeight > max ? "auto" : "hidden";
  }

  protected override update(): void {
    const area = this.#area;
    for (const name of ["placeholder"] as const) {
      const value = this.getAttribute(name);
      if (value === null) area.removeAttribute(name);
      else area.setAttribute(name, value);
    }
    area.required = this.required;
    area.disabled = this.disabled;
    if (area.value !== this.value) area.value = this.value;
    syncControlAria(this, area, this.internals.labels as NodeListOf<HTMLLabelElement>);
    if (
      !area.hasAttribute("aria-label") &&
      !("ariaLabelledByElements" in area && area.ariaLabelledByElements?.length)
    )
      area.setAttribute("aria-label", "Mensaje");
    const streaming = this.streaming;
    this.#send.hidden = streaming;
    this.#stop.hidden = !streaming;
    const sendLabel = this.getAttribute("send-label") ?? "Enviar mensaje";
    const stopLabel = this.getAttribute("stop-label") ?? "Detener respuesta";
    this.#send.setAttribute("aria-label", sendLabel);
    this.#send.title = sendLabel;
    this.#send.disabled = this.disabled || this.value.trim().length === 0;
    this.#stop.setAttribute("aria-label", stopLabel);
    this.#stop.title = stopLabel;
    this.#stop.disabled = this.disabled;
    super.update();
    this.#autosize();
  }

  protected render(): void {}

  protected override validate() {
    if (!this.required) return undefined;
    const problem = innerValidity(this.#area);
    return problem;
  }
}

/** Registers `<ui-prompt-input>` (or `<prefix-prompt-input>`) and returns the tag. */
export function definePromptInput(options?: DefineOptions): string {
  return defineElement("prompt-input", UiPromptInput, options);
}
