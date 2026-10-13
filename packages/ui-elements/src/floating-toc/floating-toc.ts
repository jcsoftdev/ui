import { createScrollSpy, type ScrollSpy } from "@jcsoftdev/ui-core/observe/scroll-spy";
import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  rootOf,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./floating-toc.css.js";

/** One entry of a table of contents. */
export interface TocItem {
  /** DOM id of the heading element. */
  id: string;
  label: string;
  /** Indentation level, 1 (default) to 3. */
  level?: 1 | 2 | 3;
}

/**
 * `<ui-toc-item target="id" level="2">Label</ui-toc-item>`: one link of a `<ui-floating-toc>`.
 * Attributes: `target` (the heading id), `level` (1 to 3, indentation).
 */
export class UiTocItem extends ElementBase {
  static observedAttributes = ["target", "level"];
  readonly link = document.createElement("a");
  #owner: Element | null = null;

  connectedCallback(): void {
    if (!this.link.isConnected) {
      const label = document.createElement("span");
      label.dataset.uiPart = "label";
      label.append(...this.childNodes);
      this.link.append(label);
      this.append(this.link);
    }
    this.setAttribute("role", "listitem");
    this.#sync();
  }

  disconnectedCallback(): void {
    this.#owner?.dispatchEvent(new Event("ui-toc-change"));
    this.#owner = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#sync();
  }

  #sync(): void {
    const target = this.getAttribute("target") ?? "";
    this.link.href = `#${target}`;
    const level = Number(this.getAttribute("level"));
    this.dataset.level = String(level >= 1 && level <= 3 ? Math.trunc(level) : 1);
    this.#owner = this.closest("[data-ui='floating-toc']") ?? this.#owner;
    this.#owner?.dispatchEvent(new Event("ui-toc-change"));
  }
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `<ui-floating-toc>`: a table of contents that tracks the section being read, as a `navigation`
 * landmark named by `heading`. An IntersectionObserver (ui-core's `observe/scroll-spy`) watches the
 * top band of the scroll area; the first heading inside it is current (`aria-current="location"`).
 * A click scrolls to the heading (smooth unless the user prefers reduced motion).
 *
 * Children: `<ui-toc-item target="heading-id" level="1|2|3">Label</ui-toc-item>`, or set the
 * `items` property to a `TocItem[]` (React `items`).
 *
 * Attributes: `heading` (the title and the landmark name; default "En esta pagina" as in the React
 * kit), `scroll-root` (CSS selector of the scroll container that holds the headings, resolved in
 * the element's root; default the viewport), `offset-top` (px reserved for a sticky header).
 * Events: `change` (`detail: { id }`) when the current section changes (React `onActiveChange`).
 * Call `refresh()` after the headings were added to the page.
 */
export class UiFloatingToc extends ElementBase {
  static observedAttributes = ["heading", "scroll-root", "offset-top"];
  readonly #title = document.createElement("p");
  readonly #list = document.createElement("div");
  #spy: ScrollSpy | undefined;
  #ids = "";
  #active: string | null = null;
  #mutations: MutationObserver | undefined;
  #arranging = false;
  #ready = false;
  #seeding = false;
  #retried = false;

  constructor() {
    super();
    this.addEventListener("ui-toc-change", () => this.#sync());
    this.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest?.("a");
      const item = link?.closest<HTMLElement>("[data-level]");
      if (!link || !item || !this.contains(item)) return;
      event.preventDefault();
      this.#jump(item.getAttribute("target") ?? "");
    });
  }

  get items(): TocItem[] {
    return this.#itemElements().map((element) => ({
      id: element.getAttribute("target") ?? "",
      label: element.textContent?.trim() ?? "",
      level: Number(element.dataset.level) as 1 | 2 | 3,
    }));
  }
  set items(items: TocItem[]) {
    for (const element of this.#itemElements()) element.remove();
    const tag = this.localName.replace(/floating-toc$/, "toc-item");
    this.append(
      ...items.map((item) => {
        const element = document.createElement(tag);
        element.setAttribute("target", item.id);
        if (item.level) element.setAttribute("level", String(item.level));
        element.textContent = item.label;
        return element;
      }),
    );
    if (this.isConnected) this.#arrange();
  }

  /** The id of the section being read, or `null` without items. */
  get active(): string | null {
    return this.#active;
  }

  connectedCallback(): void {
    connectLight(this, "floating-toc", css);
    this.#title.dataset.uiPart = "title";
    this.#list.dataset.uiPart = "list";
    this.#list.setAttribute("role", "list");
    this.prepend(this.#title, this.#list);
    this.#mutations = new MutationObserver(() => this.#arrange());
    this.#mutations.observe(this, { childList: true });
    this.#arrange();
    this.#renderHeading();
    this.#ready = true;
  }

  disconnectedCallback(): void {
    this.#mutations?.disconnect();
    this.#mutations = undefined;
    this.#spy?.destroy();
    this.#spy = undefined;
    this.#ids = "";
    this.#ready = false;
  }

  attributeChangedCallback(name: string): void {
    if (name === "heading") {
      if (this.#ready) this.#renderHeading();
    } else if (this.#ready) {
      this.#retried = false;
      this.refresh();
    }
  }

  /** Re-reads the headings and restarts the observation. */
  refresh(): void {
    this.#ids = "";
    this.#sync();
  }

  get #scrollRoot(): Element | null {
    const selector = this.getAttribute("scroll-root");
    return selector ? rootOf(this).querySelector(selector) : null;
  }

  #itemElements(): UiTocItem[] {
    return [...this.children, ...this.#list.children].filter((child): child is UiTocItem =>
      isPart(child, "toc-item"),
    );
  }

  #renderHeading(): void {
    const heading = this.getAttribute("heading") ?? "En esta página";
    this.#title.textContent = heading;
    this.setAttribute("role", "navigation");
    this.setAttribute("aria-label", heading);
  }

  #arrange(): void {
    this.#arranging = true;
    for (const child of [...this.children]) {
      if (child !== this.#title && child !== this.#list) this.#list.append(child);
    }
    this.#arranging = false;
    this.#sync();
  }

  #sync(): void {
    if (this.#arranging) return;
    const ids = this.#itemElements().map((element) => element.getAttribute("target") ?? "");
    const key = ids.join("|");
    if (key === this.#ids) {
      this.#setActive(this.#active);
      return;
    }
    this.#ids = key;
    this.#spy?.destroy();
    const root = this.#scrollRoot;
    if (this.getAttribute("scroll-root") && !root) this.#retryRoot();
    const keep = this.#active !== null && ids.includes(this.#active) ? this.#active : null;
    this.#spy = createScrollSpy({
      ids: ids.filter(Boolean),
      root,
      offsetTop: Number(this.getAttribute("offset-top")) || 0,
      onChange: (id) => {
        if (this.#seeding) return;
        this.#setActive(id);
        emit(this, "change", { id });
      },
    });
    // Start from the section already shown, so the first observation corrects it if it is stale.
    if (keep) this.#seed(keep);
    else this.#setActive(this.#spy.active);
  }

  #seed(id: string): void {
    this.#seeding = true;
    this.#spy?.set(id);
    this.#seeding = false;
    this.#setActive(id);
  }

  /** The scroll container may not be in the page yet: look once more on the next frame. */
  #retryRoot(): void {
    if (this.#retried) return;
    this.#retried = true;
    requestAnimationFrame(() => {
      if (!this.#ready) return;
      if (this.#scrollRoot) this.refresh();
      else
        console.warn(
          `${this.localName}: scroll-root "${this.getAttribute("scroll-root")}" not found`,
        );
    });
  }

  #setActive(id: string | null): void {
    this.#active = id;
    for (const element of this.#itemElements()) {
      if (element.getAttribute("target") === id)
        element.link?.setAttribute("aria-current", "location");
      else element.link?.removeAttribute("aria-current");
    }
  }

  #jump(id: string): void {
    const element = (this.#scrollRoot ?? rootOf(this)).querySelector<HTMLElement>(
      `#${CSS.escape(id)}`,
    );
    if (!element) return;
    element.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    if (!element.hasAttribute("tabindex")) element.tabIndex = -1;
    element.focus({ preventScroll: true });
    if (id === this.#active) return;
    this.#seed(id);
    emit(this, "change", { id });
  }
}

/** Registers `<ui-floating-toc>` and `<ui-toc-item>` (or the prefixed tags); returns the toc tag. */
export function defineFloatingToc(options?: DefineOptions): string {
  defineElement("toc-item", UiTocItem, options);
  return defineElement("floating-toc", UiFloatingToc, options);
}
