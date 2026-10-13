import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import { chatGlyph, setGlyph } from "../internal/chat.js";
import css from "./attachment.css.js";

/**
 * `<ui-attachment>`: a file chip or preview tile for prompt attachments, `role="group"` named
 * "Adjunto <name>" (override with `label`). While uploading it shows a `progressbar`; with
 * `removable` it shows a remove button that fires `remove` (the host is not removed for you).
 *
 * Attributes: `name` (required), `size` (pre-formatted, e.g. `240 KB`), `preview-src` (image URL or
 * object URL, shown as `<img alt="">`), `status` (`done` default, `uploading`, `error`), `progress`
 * (0-100, uploading only), `variant` (`chip` default, `preview`), `removable`, `label`,
 * `remove-label`, `uploading-label`, `error-label`, `progress-label` (text overrides; the defaults
 * are Spanish like the React kit). Maps to the React `Attachment` props: `name`, `size`,
 * `previewSrc`, `status`, `progress`, `variant`, `onRemove` (`removable` + the `remove` event).
 * Events: `remove`.
 */
export class UiAttachment extends ElementBase {
  static observedAttributes = [
    "name",
    "size",
    "preview-src",
    "status",
    "progress",
    "variant",
    "removable",
    "label",
    "remove-label",
    "uploading-label",
    "error-label",
    "progress-label",
  ];

  readonly #internals = this.attachInternals();
  readonly #thumb: HTMLElement;
  readonly #name: HTMLElement;
  readonly #detail: HTMLElement;
  readonly #bar: HTMLElement;
  readonly #fill: HTMLElement;
  readonly #remove: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = `<span part="thumbnail"></span><span part="text"><span part="name"></span><span part="detail"></span></span><span part="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" hidden><span part="fill"></span></span><button part="remove" type="button" hidden>${chatGlyph("x")}</button>`;
    this.#thumb = root.querySelector("[part=thumbnail]") as HTMLElement;
    this.#name = root.querySelector("[part=name]") as HTMLElement;
    this.#detail = root.querySelector("[part=detail]") as HTMLElement;
    this.#bar = root.querySelector("[part=progress]") as HTMLElement;
    this.#fill = root.querySelector("[part=fill]") as HTMLElement;
    this.#remove = root.querySelector("[part=remove]") as HTMLButtonElement;
    this.#internals.role = "group";
    this.#remove.addEventListener("click", () => emit(this, "remove", { name: this.name }));
  }

  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(value: string) {
    this.setAttribute("name", value);
  }
  get progress(): number | undefined {
    const raw = this.getAttribute("progress");
    if (raw === null || raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  set progress(value: number | undefined) {
    if (value === undefined) this.removeAttribute("progress");
    else this.setAttribute("progress", String(value));
  }
  get status(): "done" | "uploading" | "error" {
    const status = this.getAttribute("status");
    return status === "uploading" || status === "error" ? status : "done";
  }
  set status(value: "done" | "uploading" | "error") {
    this.setAttribute("status", value);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const name = this.name;
    const status = this.status;
    const progress = this.progress;
    const preview = this.getAttribute("variant") === "preview";
    const src = this.getAttribute("preview-src");

    this.#internals.ariaLabel = this.getAttribute("label") ?? `Adjunto ${name}`;
    this.#name.textContent = name;

    if (src) {
      let image = this.#thumb.querySelector("img");
      if (!image) {
        image = document.createElement("img");
        image.alt = "";
        this.#thumb.replaceChildren(image);
      }
      if (image.getAttribute("src") !== src) image.setAttribute("src", src);
    } else setGlyph(this.#thumb, status === "error" ? "alert" : "file");

    const detail =
      status === "uploading"
        ? `${this.getAttribute("uploading-label") ?? "Subiendo"}${progress != null ? ` ${Math.round(progress)}%` : "…"}`
        : status === "error"
          ? (this.getAttribute("error-label") ?? "Error al subir")
          : (this.getAttribute("size") ?? "");
    this.#detail.textContent = detail;
    this.#detail.hidden = !detail || (!preview && status === "done");

    const showBar = status === "uploading" && progress != null;
    this.#bar.hidden = !showBar;
    if (showBar && progress != null) {
      const clamped = Math.min(100, Math.max(0, progress));
      this.#bar.setAttribute(
        "aria-label",
        this.getAttribute("progress-label") ?? `Progreso de ${name}`,
      );
      this.#bar.setAttribute("aria-valuenow", String(Math.round(progress)));
      this.#fill.style.width = `${clamped}%`;
    }

    const removable = this.hasAttribute("removable");
    this.#remove.hidden = !removable;
    const removeLabel = this.getAttribute("remove-label") ?? `Quitar ${name}`;
    this.#remove.setAttribute("aria-label", removeLabel);
    this.#remove.title = removeLabel;
  }
}

/** Registers `<ui-attachment>` (or `<prefix-attachment>`) and returns the tag. */
export function defineAttachment(options?: DefineOptions): string {
  return defineElement("attachment", UiAttachment, options);
}
