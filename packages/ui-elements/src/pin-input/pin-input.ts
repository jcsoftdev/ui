import { type OtpCharset, sanitizeOtp } from "@jcsoftdev/ui-core/otp";
import { adoptStyles, type DefineOptions, defineElement, emit, uid } from "../internal/base.js";
import { controlName, numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import css from "./pin-input.css.js";

type DescribedInput = HTMLInputElement & { ariaDescribedByElements?: Element[] | null };

const CHARSETS: readonly OtpCharset[] = ["numeric", "alphanumeric", "any"];

/**
 * `<ui-pin-input>`: masked PIN, a native `type="password"` input in a shadow root plus one dot per
 * position (the React kit's `PinInput`). Input is cut to `length` characters of the `charset`
 * with ui-core `sanitizeOtp`. `autocomplete="off"` on purpose, so browsers do not take it for a
 * one-time code. A polite live region announces the progress.
 *
 * `variant="cells"` swaps the field for one input per position, driven by ui-core `createOtp`
 * (loaded on demand, so the default look never downloads it): typing advances, a paste or an
 * autofill spreads over the cells, Backspace steps back, arrows and Home/End move between cells.
 * Add `mask` to hide the digits of the cells. In both looks the value is the code as text.
 *
 * Attributes: `value`, `name`, `length` (4), `charset` (`numeric`, `alphanumeric`, `any`),
 * `variant` (`cells`), `mask`, `label` or `aria-label` (accessible name, "PIN"), `status-label`
 * (announcement template, "{entered} of {length} digits entered"), `required`, `disabled`,
 * `invalid`. Events: `input` per change, `change` when committed (blur or Enter; when complete
 * in `cells`), `complete` with `detail.value` once every position is filled.
 */
export class UiPinInput extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "length",
    "charset",
    "variant",
    "mask",
    "label",
    "aria-label",
    "aria-describedby",
    "status-label",
    "invalid",
  ];

  readonly #shadow: ShadowRoot;
  readonly #status = uid("pin-status");
  #shape = "";
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(this.#shadow, css);
  }

  get length(): number {
    return Math.max(1, Math.floor(numberAttr(this, "length", 4)));
  }
  get charset(): OtpCharset {
    const charset = this.getAttribute("charset") as OtpCharset | null;
    return charset && CHARSETS.includes(charset) ? charset : "numeric";
  }
  get cells(): boolean {
    return this.getAttribute("variant") === "cells";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#stop?.();
    this.#stop = undefined;
    this.#shape = "";
  }

  override get value(): string {
    return sanitizeOtp(super.value, this.charset, this.length);
  }
  override set value(value: string) {
    super.value = value;
  }

  protected override update(): void {
    super.update();
    this.internals.setFormValue(this.value || null);
  }

  protected render(): void {
    const { length, cells } = this;
    const shape = `${cells}|${length}|${this.hasAttribute("mask")}|${this.charset}`;
    if (shape !== this.#shape) {
      this.#shape = shape;
      this.#build(cells, length);
    }
    const value = sanitizeOtp(this.value, this.charset, length);
    const name = controlName(this, this.internals.labels as NodeListOf<HTMLLabelElement>) || "PIN";
    const template = this.getAttribute("status-label") ?? "{entered} of {length} digits entered";
    const status = this.#shadow.getElementById(this.#status) as HTMLElement;
    status.textContent = template
      .replace("{entered}", String(value.length))
      .replace("{length}", String(length));
    const invalid = this.hasAttribute("invalid");
    const cellInputs = this.#cells();
    if (cells) {
      const root = this.#shadow.querySelector("[part=cells]") as HTMLElement;
      root.setAttribute("aria-label", name);
      root.setAttribute("aria-describedby", this.#status);
      if (cellInputs.map((cell) => cell.value).join("") !== value)
        cellInputs.forEach((cell, at) => {
          cell.value = value.charAt(at);
        });
      cellInputs.forEach((cell, at) => {
        cell.disabled = this.disabled;
        cell.setAttribute("aria-label", `${name} ${at + 1} of ${length}`);
        if (invalid) cell.setAttribute("aria-invalid", "true");
        else cell.removeAttribute("aria-invalid");
      });
      return;
    }
    const input = this.#input() as DescribedInput;
    if (input.value !== value) input.value = value;
    input.disabled = this.disabled;
    input.setAttribute("aria-label", name);
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    const root = this.getRootNode() as Document | ShadowRoot;
    const described = (this.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => (id ? root.getElementById?.(id) : null))
      .filter((element): element is HTMLElement => !!element);
    if ("ariaDescribedByElements" in input) input.ariaDescribedByElements = [...described, status];
    else (input as HTMLInputElement).setAttribute("aria-describedby", this.#status);
    this.#shadow.querySelectorAll("[part=dot]").forEach((dot, at) => {
      dot.toggleAttribute("data-filled", at < value.length);
    });
  }

  protected override validate() {
    const base = super.validate();
    const anchor = this.#cells()[0] ?? this.#input();
    if (base) return { ...base, anchor };
    if (this.value !== "" && this.value.length < this.length)
      return {
        flags: { tooShort: true },
        message: `Enter all ${this.length} characters.`,
        anchor,
      };
    return undefined;
  }

  #input(): HTMLInputElement | undefined {
    return this.#shadow.querySelector<HTMLInputElement>("input[part=input]") ?? undefined;
  }

  #cells(): HTMLInputElement[] {
    return [...this.#shadow.querySelectorAll<HTMLInputElement>("input[part=cell]")];
  }

  #build(cells: boolean, length: number): void {
    this.#stop?.();
    this.#stop = undefined;
    const numeric = this.charset === "numeric";
    const inputmode = numeric ? "numeric" : "text";
    const status = `<span part="status" id="${this.#status}" aria-live="polite"></span>`;
    if (cells) {
      const type = this.hasAttribute("mask") ? "password" : "text";
      this.#shadow.innerHTML = `<div part="cells" role="group">${Array.from(
        { length },
        (_, at) =>
          `<input part="cell" type="${type}" inputmode="${inputmode}" autocomplete="${at === 0 ? "one-time-code" : "off"}" spellcheck="false">`,
      ).join("")}</div>${status}`;
      this.#mountCells();
      return;
    }
    this.#shadow.innerHTML = `<div part="dots" aria-hidden="true">${'<i part="dot"></i>'.repeat(length)}</div><input part="input" type="password" inputmode="${inputmode}" autocomplete="off">${status}`;
    const input = this.#input() as HTMLInputElement;
    input.addEventListener("input", () => {
      const value = sanitizeOtp(input.value, this.charset, length);
      input.value = value;
      this.#publish(value);
    });
    // `change` is not composed: re-dispatch it from the host.
    input.addEventListener("change", () => emit(this, "change"));
  }

  #mountCells(): void {
    let alive = true;
    let destroy: (() => void) | undefined;
    this.#stop = () => {
      alive = false;
      destroy?.();
    };
    void import("@jcsoftdev/ui-core/otp").then(({ createOtp }) => {
      const root = this.#shadow.querySelector<HTMLElement>("[part=cells]");
      if (!alive || !root) return;
      const otp = createOtp(root, {
        cells: () => this.#cells(),
        charset: this.charset,
        onChange: (code) => this.#publish(code),
        onComplete: () => emit(this, "change"),
      });
      destroy = () => otp.destroy();
    });
  }

  /** A user edit: stores the value, fires `input`, and `complete` when every position is filled. */
  #publish(value: string): void {
    if (this.disabled) return;
    this.value = value;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    if (value.length === this.length) emit(this, "complete", { value });
  }
}

/** Registers `<ui-pin-input>` (or `<prefix-pin-input>`) and returns the tag. */
export function definePinInput(options?: DefineOptions): string {
  return defineElement("pin-input", UiPinInput, options);
}
