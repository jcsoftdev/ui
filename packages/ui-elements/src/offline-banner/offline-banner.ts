import { observeOnline } from "@jcsoftdev/ui-core/observe/online";
import { type DefineOptions, defineElement, emit, toggleAttr } from "../internal/base.js";
import { BannerBase, type BannerTone } from "../internal/e3-banner.js";

/**
 * `<ui-offline-banner>`: a warning banner for a lost connection, with an optional counter of the
 * changes queued until it comes back (a polite `role="status"`).
 * Attributes: `message` (React `message`; the default slot also works), `queued-changes` (count,
 * shown when above 0), `queued-label` (screen reader text for the counter, defaults to the number),
 * `auto` (tracks connectivity with ui-core `observe/online`: the banner is hidden while online and
 * a `change` event with `{ online }` fires on every switch; without it the banner is always shown,
 * as in the React kit). `heading`, `no-icon` and the `icon` / `action` slots work as in `<ui-banner>`.
 */
export class UiOfflineBanner extends BannerBase {
  static observedAttributes = ["message", "queued-changes", "queued-label", "auto", "heading"];

  readonly #message = document.createElement("span");
  readonly #count = document.createElement("span");
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#message.setAttribute("part", "message");
    this.#count.setAttribute("part", "count");
    this.body.insertBefore(this.#message, this.body.querySelector("slot"));
  }

  protected override get tone(): BannerTone {
    return "warning";
  }

  connectedCallback(): void {
    this.#render();
    this.#track();
  }

  disconnectedCallback(): void {
    this.#stop?.();
    this.#stop = undefined;
  }

  attributeChangedCallback(name: string): void {
    this.#render();
    if (name === "auto") this.#track();
  }

  #track(): void {
    this.#stop?.();
    this.#stop = undefined;
    if (!this.hasAttribute("auto") || !this.isConnected) {
      toggleAttr(this, "data-online", false);
      return;
    }
    const apply = (online: boolean, announce: boolean) => {
      toggleAttr(this, "data-online", online);
      if (announce) emit(this, "change", { online });
    };
    apply(navigator.onLine !== false, false);
    this.#stop = observeOnline((online) => apply(online, true));
  }

  #render(): void {
    this.renderBanner();
    const message = this.getAttribute("message");
    this.#message.textContent = message ?? "";
    this.#message.hidden = !message;
    const queued = Number(this.getAttribute("queued-changes") ?? 0);
    if (queued > 0) {
      const label = this.getAttribute("queued-label") ?? String(queued);
      this.#count.innerHTML = "";
      const visible = document.createElement("span");
      visible.setAttribute("aria-hidden", "true");
      visible.textContent = String(queued);
      const hidden = document.createElement("span");
      hidden.className = "sr-only";
      hidden.textContent = label;
      this.#count.append(visible, hidden);
      this.action.prepend(this.#count);
    } else this.#count.remove();
    this.syncAction();
  }
}

/** Registers `<ui-offline-banner>` (or `<prefix-offline-banner>`) and returns the tag. */
export function defineOfflineBanner(options?: DefineOptions): string {
  return defineElement("offline-banner", UiOfflineBanner, options);
}
