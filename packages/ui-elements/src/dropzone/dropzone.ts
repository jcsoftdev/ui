import { createFileDrop, type FileDrop, type FileRejection } from "@jcsoftdev/ui-core/file-drop";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  emit,
  ensureId,
  toggleAttr,
} from "../internal/base.js";
import { controlName, icon, numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import css from "./dropzone.css.js";

export type { FileRejection };

/**
 * `<ui-dropzone>`: drag-and-drop plus a browse button for files. Only file drags count, picked and
 * dropped files share one validation (ui-core `file-drop`: type, then size), and the dragging state
 * does not flicker over the children. The element is form-associated: the accepted files are
 * submitted under `name` (a `FormData` of `File`s, like a native file input), a new batch replaces
 * the previous one, and `form.reset()` clears them.
 *
 * Content: the default slot is the title, `slot="hint"` the hint. Attributes: `name`, `accept`
 * (comma list of MIME types, `image/*` wildcards and `.ext` suffixes), `max-size` (bytes),
 * `multiple` (on unless `multiple="false"`), `browse-label` ("Browse files"), `required`,
 * `disabled`, `label` or `aria-label` (names the group). The `dragging` attribute reflects a file
 * drag over the zone. Properties: `files` (readonly copy), `clear()`, `browse()`.
 *
 * Events: `files` with `detail.files` for each accepted batch, then `input` and `change`;
 * `reject` with `detail.rejections` (`{ file, reason: "type" | "size" }`) for the refused ones.
 */
export class UiDropzone extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "accept",
    "max-size",
    "multiple",
    "browse-label",
    "label",
    "aria-label",
  ];

  readonly #button: HTMLButtonElement;
  readonly #hint: HTMLElement;
  #drop: FileDrop | undefined;
  #files: File[] = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = `<div part="root"><span part="icon">${icon("upload")}</span><b part="title"><slot></slot></b><span part="hint" hidden><slot name="hint"></slot></span><button part="browse" type="button"></button></div>`;
    this.#button = root.querySelector("button") as HTMLButtonElement;
    this.#hint = root.querySelector("[part=hint]") as HTMLElement;
    const title = root.querySelector("[part=title]") as HTMLElement;
    this.#button.setAttribute(
      "aria-describedby",
      `${ensureId(title, "dropzone-title")} ${ensureId(this.#hint, "dropzone-hint")}`,
    );
    this.#button.addEventListener("click", () => this.browse());
    (root.querySelector("slot[name=hint]") as HTMLSlotElement).addEventListener(
      "slotchange",
      (event) => {
        this.#hint.hidden = (event.target as HTMLSlotElement).assignedNodes().length === 0;
      },
    );
    this.internals.role = "group";
  }

  /** The accepted files of the last batch. */
  get files(): File[] {
    return [...this.#files];
  }

  override get value(): string {
    return super.value;
  }
  /** Only `""` is accepted: it clears the files. Files cannot be set from a string. */
  override set value(value: string) {
    if (value === "") this.clear();
  }

  /** Opens the native file picker, with the same rules as a drop. */
  browse(): void {
    this.#drop?.open();
  }

  clear(): void {
    this.#files = [];
    super.value = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#bind();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#drop?.destroy();
    this.#drop = undefined;
  }

  override attributeChangedCallback(name: string, old?: string | null, next?: string | null): void {
    super.attributeChangedCallback(name, old, next);
    if (this.#drop && ["accept", "max-size", "multiple"].includes(name)) this.#bind();
  }

  override formResetCallback(): void {
    this.#files = [];
    super.formResetCallback();
  }

  override formStateRestoreCallback(): void {}

  protected override update(): void {
    super.update();
    const { name } = this;
    if (!name || this.#files.length === 0) this.internals.setFormValue(null);
    else {
      const data = new FormData();
      for (const file of this.#files) data.append(name, file);
      this.internals.setFormValue(data);
    }
  }

  protected override validate() {
    if (this.required && this.#files.length === 0)
      return {
        flags: { valueMissing: true },
        message: "Select a file.",
        anchor: this.#button,
      };
    return undefined;
  }

  protected render(): void {
    this.#button.textContent = this.getAttribute("browse-label") ?? "Browse files";
    this.#button.disabled = this.disabled;
    this.internals.ariaLabel =
      controlName(this, this.internals.labels as NodeListOf<HTMLLabelElement>) || null;
  }

  #bind(): void {
    this.#drop?.destroy();
    const accept = (this.getAttribute("accept") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const size = numberAttr(this, "max-size", Number.NaN);
    this.#drop = createFileDrop(this, {
      accept,
      maxSize: Number.isNaN(size) ? undefined : size,
      multiple: this.getAttribute("multiple") !== "false",
      disabled: () => this.disabled,
      onDraggingChange: (dragging) => toggleAttr(this, "dragging", dragging),
      onFiles: (files) => {
        this.#files = files;
        super.value = files.map((file) => file.name).join(", ");
        emit(this, "files", { files });
        this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        this.dispatchEvent(new Event("change", { bubbles: true }));
      },
      onReject: (rejections) => emit(this, "reject", { rejections }),
    });
  }
}

/** Registers `<ui-dropzone>` (or `<prefix-dropzone>`) and returns the tag. */
export function defineDropzone(options?: DefineOptions): string {
  return defineElement("dropzone", UiDropzone, options);
}
