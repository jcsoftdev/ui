import { createDisclosure, type Disclosure } from "@jcsoftdev/ui-core/disclosure";
import { flattenTree, type TreeKey, type TreeNode, treeStep } from "@jcsoftdev/ui-core/tree";
import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  toggleAttr,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { icon, watchCompact } from "../internal/e8-shell.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./sidebar.css.js";

/** What the sidebar's keyboard model needs to know about a navigable node. */
interface NavNode {
  /** The focusable row: a link, or the button of a branch or of a collapsible group. */
  readonly navLink: HTMLElement | null;
  /** Present when the node opens and closes. */
  readonly navDisclosure: Disclosure | undefined;
  navChildren(): HTMLElement[];
}

const chevron = () => icon("m9 6 6 6-6 6");

function part<T extends HTMLElement>(tag: string, name: string): T {
  const element = document.createElement(tag) as T;
  element.dataset.uiPart = name;
  return element;
}

/**
 * `<ui-sidebar-item href="/x" active badge="3">Label</ui-sidebar-item>`: one link of the sidebar.
 * Put an icon in a child with `slot="icon"` and a custom badge in a child with `slot="badge"`.
 * An item that contains other `<ui-sidebar-item>` is a branch: its row is a disclosure button
 * (`aria-expanded`) that opens and closes the nested items (nested items must exist when it
 * connects); it has no `href`.
 *
 * Attributes: `href`, `active` (the current page: `aria-current="page"` and the accent look),
 * `badge` (short text), `badge-tone` (`default` | `danger`), `badge-label` (screen-reader-only
 * context announced after the badge), `expanded` (a branch is open). Event: `toggle`
 * (`detail: { open }`) when a branch opens or closes.
 */
export class UiSidebarItem extends ElementBase implements NavNode {
  static observedAttributes = ["href", "active", "badge", "badge-tone", "badge-label", "expanded"];
  readonly #badge = part<HTMLSpanElement>("span", "badge");
  readonly #badgeText = document.createTextNode("");
  readonly #badgeLabel = part<HTMLSpanElement>("span", "badge-label");
  #link: HTMLAnchorElement | HTMLButtonElement | null = null;
  #panel: HTMLElement | null = null;
  #disclosure: Disclosure | undefined;

  get navLink(): HTMLElement | null {
    return this.#link;
  }
  get navDisclosure(): Disclosure | undefined {
    return this.#disclosure;
  }
  navChildren(): HTMLElement[] {
    return [...(this.#panel?.children ?? [])].filter((child): child is HTMLElement =>
      isPart(child, "sidebar-item"),
    );
  }

  connectedCallback(): void {
    connectLight(this, "sidebar-item", css);
    if (!this.#link) this.#build();
    this.#sync();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#link) return;
    if (name === "expanded") this.#disclosure?.set(this.hasAttribute("expanded"));
    else this.#sync();
  }

  #build(): void {
    const nodes = [...this.childNodes];
    const nested = nodes.filter(
      (node): node is HTMLElement => node instanceof HTMLElement && isPart(node, "sidebar-item"),
    );
    const slotted = (name: string) =>
      nodes.filter((node) => node instanceof Element && node.getAttribute("slot") === name);
    const icons = slotted("icon");
    const badges = slotted("badge");
    const label = part<HTMLSpanElement>("span", "label");
    for (const node of nodes)
      if (!nested.includes(node as HTMLElement) && !icons.includes(node) && !badges.includes(node))
        label.append(node);
    const branch = nested.length > 0;
    const link = part<HTMLAnchorElement | HTMLButtonElement>(branch ? "button" : "a", "link");
    if (link instanceof HTMLButtonElement) link.type = "button";
    this.#badge.append(this.#badgeText, ...badges, this.#badgeLabel);
    link.append(...icons, label, this.#badge);
    if (branch) link.append(chevron());
    this.#link = link;
    this.append(link);
    if (!branch) return;
    const panel = part<HTMLDivElement>("div", "children");
    panel.append(...nested);
    this.#panel = panel;
    this.append(panel);
    this.#disclosure = createDisclosure({
      trigger: link,
      panel,
      defaultOpen: this.hasAttribute("expanded"),
      onOpenChange: (open) => {
        toggleAttr(this, "expanded", open);
        emit(this, "toggle", { open });
      },
    });
  }

  #sync(): void {
    const link = this.#link;
    if (!link) return;
    const active = this.hasAttribute("active");
    toggleAttr(this, "data-active", active);
    if (link instanceof HTMLAnchorElement) {
      const href = this.getAttribute("href");
      if (href === null) link.removeAttribute("href");
      else link.setAttribute("href", href);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const text = this.getAttribute("badge");
    this.#badgeText.data = text ?? "";
    const context = this.getAttribute("badge-label");
    this.#badgeLabel.textContent = context ? ` ${context}` : "";
    this.#badge.hidden = text === null && this.#badge.childElementCount === 1;
    this.#badge.dataset.tone = this.getAttribute("badge-tone") === "danger" ? "danger" : "default";
  }
}

/**
 * `<ui-sidebar-group label="Workspace">`: a named group of links, a `navigation` landmark named by
 * `label`, with the label shown above the links. With `collapsible` it becomes a disclosure: the
 * label is a button (`aria-expanded`) that shows and hides the links.
 *
 * Attributes: `label`, `collapsible` (read when it connects), `collapsed` (hidden to start, or
 * to toggle later). Event: `toggle` (`detail: { open }`).
 */
export class UiSidebarGroup extends ElementBase implements NavNode {
  static observedAttributes = ["label", "collapsed"];
  readonly #internals = this.attachInternals();
  readonly #text = document.createElement("span");
  #label: HTMLElement | null = null;
  #panel: HTMLElement | null = null;
  #disclosure: Disclosure | undefined;
  #mutations: MutationObserver | undefined;

  constructor() {
    super();
    this.#internals.role = "navigation";
  }

  get navLink(): HTMLElement | null {
    return this.#disclosure ? this.#label : null;
  }
  get navDisclosure(): Disclosure | undefined {
    return this.#disclosure;
  }
  navChildren(): HTMLElement[] {
    return [...(this.#panel ?? this).children].filter((child): child is HTMLElement =>
      isPart(child, "sidebar-item"),
    );
  }

  connectedCallback(): void {
    connectLight(this, "sidebar-group", css);
    if (!this.#label) this.#build();
    this.#render();
  }

  disconnectedCallback(): void {
    this.#mutations?.disconnect();
    this.#mutations = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (!this.#label) return;
    if (name === "collapsed") this.#disclosure?.set(!this.hasAttribute("collapsed"));
    else this.#render();
  }

  #build(): void {
    const collapsible = this.hasAttribute("collapsible");
    const label = part<HTMLElement>(collapsible ? "button" : "div", "label");
    label.append(this.#text);
    this.#label = label;
    if (!collapsible) {
      this.prepend(label);
      return;
    }
    (label as HTMLButtonElement).type = "button";
    label.append(chevron());
    const panel = part<HTMLDivElement>("div", "items");
    panel.append(...this.childNodes);
    this.append(label, panel);
    this.#panel = panel;
    this.#disclosure = createDisclosure({
      trigger: label,
      panel,
      defaultOpen: !this.hasAttribute("collapsed"),
      onOpenChange: (open) => {
        toggleAttr(this, "collapsed", !open);
        emit(this, "toggle", { open });
      },
    });
    this.#mutations = new MutationObserver(() => {
      for (const child of [...this.children])
        if (child !== label && child !== panel) panel.append(child);
    });
    this.#mutations.observe(this, { childList: true });
  }

  #render(): void {
    const label = this.getAttribute("label") ?? "";
    this.#internals.ariaLabel = label;
    this.#text.textContent = label;
  }
}

const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];

/**
 * `<ui-sidebar aria-label="Main">`: the main navigation, a `complementary` landmark. In a wide
 * container it is always visible (sticky); when its `<ui-app-shell>` is narrower than 900 px (or,
 * outside a shell, its parent element) it is an off-canvas drawer, `inert` while closed so the
 * keyboard cannot reach it. The container decides, never the viewport.
 *
 * Children: `<ui-sidebar-group label>` of `<ui-sidebar-item href>`; `slot="header"` (brand) and
 * `slot="footer"` (pinned to the bottom, such as the current user) blocks.
 *
 * Keyboard: Tab goes through every link. As an enhancement, the tree keys of ui-core's `tree` work
 * on the rows: ArrowUp/ArrowDown and Home/End move between visible links, ArrowRight opens a
 * branch (or a collapsed group) and then moves into it, ArrowLeft closes it or goes to its parent.
 * In the open drawer, Escape closes it and focus starts on the first link.
 *
 * Attributes: `open` (drawer state when compact; ignored when the container is wide), and
 * `material="liquid" | "liquid-clear"` plus its tuning attributes (Liquid Glass, loaded lazily,
 * only then). Events: `close` (Escape or a click on the scrim in the open drawer; React `onClose`).
 * The `compact` state is reflected as `data-compact="true" | "false"`.
 */
export class UiSidebar extends ElementBase {
  static observedAttributes: string[] = [...MATERIAL_ATTRIBUTES, "open"];
  readonly #internals = this.attachInternals();
  readonly #material = new Material(this, () => this);
  readonly #scrim = document.createElement("div");
  #compact = false;
  #drawer = false;
  #stopCompact: (() => void) | undefined;

  constructor() {
    super();
    this.#internals.role = "complementary";
    this.#scrim.dataset.ui = "sidebar-scrim";
    this.#scrim.setAttribute("aria-hidden", "true");
    this.#scrim.addEventListener("click", () => emit(this, "close"));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    toggleAttr(this, "open", value);
  }

  connectedCallback(): void {
    connectLight(this, "sidebar", css);
    this.#stopCompact = watchCompact(this, (compact) => {
      this.#compact = compact;
      this.setAttribute("data-compact", String(compact));
      this.#sync();
    });
    window.addEventListener("keydown", this.#onEscape);
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#stopCompact?.();
    window.removeEventListener("keydown", this.#onEscape);
    this.#scrim.remove();
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) this.#material.sync();
    else if (this.isConnected) this.#sync();
  }

  readonly #onEscape = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.#drawer) emit(this, "close");
  };

  #sync(): void {
    const drawer = this.#compact && this.open;
    this.inert = this.#compact && !this.open;
    toggleAttr(this, "data-open", this.open);
    if (drawer && !this.#scrim.isConnected) this.after(this.#scrim);
    if (!drawer) this.#scrim.remove();
    if (drawer && !this.#drawer) this.querySelector<HTMLElement>("a[href]")?.focus();
    this.#drawer = drawer;
  }

  #top(): HTMLElement[] {
    return [...this.children].filter(
      (child): child is HTMLElement =>
        isPart(child, "sidebar-group") || isPart(child, "sidebar-item"),
    );
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (
      !KEYS.includes(event.key) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    const nodes = new Map<string, NavNode>();
    const rows = new Map<EventTarget, string>();
    const open = new Set<string>();
    const build = (elements: HTMLElement[]): TreeNode[] =>
      elements.flatMap((element) => {
        const nav = element as unknown as NavNode;
        if (isPart(element, "sidebar-group") && !nav.navDisclosure) return build(nav.navChildren());
        const id = String(nodes.size);
        nodes.set(id, nav);
        if (nav.navLink) rows.set(nav.navLink, id);
        if (nav.navDisclosure?.open) open.add(id);
        return [
          nav.navDisclosure
            ? { id, name: "", children: build(nav.navChildren()) }
            : { id, name: "" },
        ];
      });
    const tree = build(this.#top());
    const current = event.target ? rows.get(event.target) : undefined;
    if (current === undefined) return;
    const step = treeStep(flattenTree(tree, open), current, event.key as TreeKey);
    if (!step) return;
    event.preventDefault();
    const node = nodes.get(step.id);
    if (step.type === "focus") node?.navLink?.focus();
    else node?.navDisclosure?.set(step.type === "expand");
  }
}

/**
 * Registers `<ui-sidebar>` with `<ui-sidebar-group>` and `<ui-sidebar-item>` (or the same under
 * another prefix) and returns the sidebar tag.
 */
export function defineSidebar(options?: DefineOptions): string {
  defineElement("sidebar-item", UiSidebarItem, options);
  defineElement("sidebar-group", UiSidebarGroup, options);
  return defineElement("sidebar", UiSidebar, options);
}
