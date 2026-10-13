import { createDismissLayer, type OutsideEvent } from "@jcsoftdev/ui-core/dismiss";
import {
  bindSubmenuTrigger,
  createMenuContent,
  type FocusIntent,
  type MenuContent,
  type MenuSelectDetail,
} from "@jcsoftdev/ui-core/menu";
import { waitForExit } from "@jcsoftdev/ui-core/presence";
import { AnchoredOverlay } from "./anchored.js";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  ensureId,
  rootOf,
} from "./base.js";
import css from "./e6-menu.css.js";

const CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const CHEVRON =
  '<svg data-ui-part="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

const ROOT = "[data-ui-menu-root]";
const CONTENT = "[data-ui-menu]";

/** Everything the menu content needs from the element that owns it (dropdown or context menu). */
export abstract class MenuRootElement extends ElementBase {
  static observedAttributes = ["open", "modal"];

  /** Whether the menu is modal unless `modal` says otherwise. */
  protected abstract readonly modalDefault: boolean;
  protected abstract readonly kind: string;

  /** The menu, as `modal="false"` (dropdown) or `modal` (context menu) set it. */
  get modal(): boolean {
    const value = this.getAttribute("modal");
    return value === null ? this.modalDefault : value !== "false";
  }

  get content(): MenuContentElement | null {
    return this.querySelector<MenuContentElement>(`${CONTENT}:not([data-sub])`);
  }

  get open(): boolean {
    return this.content?.open ?? false;
  }
  set open(value: boolean) {
    this.toggleAttribute("open", value);
  }

  /** Where focus goes when the menu closes. */
  abstract returnTarget(): HTMLElement | null;
  /** The element the menu opens against. */
  protected abstract anchor(): HTMLElement | null;

  show(intent: FocusIntent = "none"): void {
    this.content?.openAt(this.anchor(), intent);
  }
  hide(): void {
    this.content?.hide();
  }
  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  protected ready = false;

  constructor() {
    super();
    // open and close of the main content (sub-menus fire them too) keep the `open` attribute.
    const sync = (event: Event) => {
      if (event.target !== this.content) return;
      this.toggleAttribute("open", event.type === "open");
      this.stateChanged(event.type === "open");
    };
    this.addEventListener("open", sync);
    this.addEventListener("close", sync);
  }

  protected stateChanged(_open: boolean): void {}

  connectedCallback(): void {
    this.setAttribute("data-ui-menu-root", "");
    this.dataset.ui = this.kind;
    adoptStyles(rootOf(this), css);
    this.ready = true;
    this.connected();
    if (this.hasAttribute("open")) queueMicrotask(() => this.show());
  }

  disconnectedCallback(): void {
    this.ready = false;
    this.disconnected();
  }

  attributeChangedCallback(name: string): void {
    if (!this.ready || name !== "open") return;
    const want = this.hasAttribute("open");
    if (this.open === want) return;
    if (want) this.show();
    else this.hide();
  }

  protected connected(): void {}
  protected disconnected(): void {}
}

/**
 * The surface of a menu: a manual `popover` (top layer) placed with ui-core's `autoPosition`,
 * dismissed by a ui-core dismiss layer (stacked: Escape and outside presses reach the topmost
 * menu only, also inside a modal dialog), with the keyboard, pointer and typeahead behaviour of
 * ui-core's `createMenuContent`. A modal menu also makes the page inert, blocks the pointer
 * outside it and locks scroll, through a lazy chunk. Exit animations run through ui-core's
 * `waitForExit`: the element carries `data-state="open|closed"`.
 */
export class MenuContentElement extends AnchoredOverlay {
  protected readonly popoverMode = "manual" as const;
  protected readonly defaultOffset: number = 6;

  /** Where focus goes on the next open. */
  focusIntent: FocusIntent = "none";
  /** The behaviour handle while open. */
  menu: MenuContent | undefined;
  protected isSub = false;
  /** Set by Tab: which way focus moves on from the trigger once the menu closed. */
  exitTab: "forward" | "backward" | null = null;
  /** The last press outside was not meant to bring focus back to the trigger. */
  interactedOutside = false;

  #layer: (() => void) | undefined;
  #unmodal: (() => void) | undefined;
  #openings = 0;

  constructor() {
    super();
    // `ui.menu.itemSelect` (cancelable) becomes the public, cancelable `select` event.
    this.addEventListener("ui.menu.itemSelect", (event) => {
      const { item, checked } = (event as CustomEvent<MenuSelectDetail>).detail;
      if (!emit(item, "select", { checked }, true)) event.preventDefault();
    });
  }

  protected get menuRoot(): MenuRootElement | null {
    return this.closest<MenuRootElement>(ROOT);
  }

  /** The content of the whole menu: this one, or the root content a sub-menu hangs from. */
  protected get topContent(): MenuContentElement {
    let node: MenuContentElement = this;
    while (node.isSub) {
      const parent = node.parentElement?.closest<MenuContentElement>(CONTENT);
      if (!parent) break;
      node = parent;
    }
    return node;
  }

  openAt(anchor: HTMLElement | null, intent: FocusIntent): void {
    this.focusIntent = intent;
    this.show(anchor);
  }

  protected override connected(): void {
    this.setAttribute("data-ui-menu", "");
    // ui-core's marker of a menu content: it keeps a closed sub-menu's items out of its parent.
    this.setAttribute("data-ui-menu-content", "");
    if (this.isSub) this.setAttribute("data-sub", "");
    this.setAttribute("role", "menu");
    this.setAttribute("aria-orientation", "vertical");
    this.tabIndex = -1;
    adoptStyles(rootOf(this), css);
  }

  protected override exit(hide: () => void): () => void {
    this.dataset.state = "closed";
    return waitForExit(this, hide);
  }

  protected override opened(): void {
    this.dataset.state = "open";
    const anchor = this.anchorElement;
    if (anchor) {
      this.setAttribute("aria-labelledby", ensureId(anchor, "menu-trigger"));
      anchor.setAttribute("aria-controls", ensureId(this, "menu"));
    }
    const root = this.menuRoot;
    const parent = this.isSub
      ? this.parentElement?.closest<MenuContentElement>(CONTENT)?.menu
      : undefined;
    const menu = createMenuContent(this, {
      onSelect: () => this.topContent.hide(),
      onTab: (backward) => {
        const top = this.topContent;
        top.exitTab = backward ? "backward" : "forward";
        top.hide();
      },
      submenu:
        this.isSub && anchor && parent
          ? { trigger: anchor, close: () => this.hide(), parent }
          : undefined,
    });
    this.menu = menu;
    for (const sub of this.querySelectorAll<MenuSubElement>("[data-ui-menu-sub]"))
      if (sub.closest(CONTENT) === this) sub.bind(menu);

    this.#layer = createDismissLayer(this, {
      onDismiss: () => this.hide(),
      inside: () => [this.anchorElement],
      onFocusOutside: (event) => this.#onFocusOutside(event),
      onPointerDownOutside: (event) => this.#onPointerDownOutside(event),
    });

    if (!this.isSub && root?.modal) {
      const opening = ++this.#openings;
      import("./e6-menu-modal.js").then(({ lockModal }) => {
        if (!this.open || opening !== this.#openings) return;
        this.#unmodal = lockModal(this);
      });
    }

    // A sub-menu opened by the pointer leaves focus on its trigger until the pointer or keys move it.
    const intent = this.focusIntent;
    this.focusIntent = "none";
    if (!(this.isSub && intent === "none")) menu.focusEntry(intent);
  }

  #onFocusOutside(event: OutsideEvent<FocusEvent>): void {
    if (!this.isSub) {
      event.preventDefault();
      return;
    }
    // Moving to another item of a parent menu closes the sub-menu; nothing else does.
    const target = event.detail.originalEvent.target as Node | null;
    if ((target && this.anchorElement?.contains(target)) || !this.#insideMenu(target))
      event.preventDefault();
  }

  #onPointerDownOutside(event: OutsideEvent<PointerEvent>): void {
    const original = event.detail.originalEvent;
    const modal = this.menuRoot?.modal ?? false;
    const contextClick = original.button === 2 || (original.button === 0 && original.ctrlKey);
    const top = this.topContent;
    if (!this.isSub) {
      // A modal menu hands focus back to the trigger, except after a context click.
      if (!modal || contextClick) this.interactedOutside = true;
      return;
    }
    const target = original.target as Node | null;
    if (target && this.anchorElement?.contains(target)) event.preventDefault();
    else if (target && top.anchorElement?.contains(target)) event.preventDefault();
    else if (!this.#insideMenu(target)) {
      event.preventDefault();
      top.interactedOutside = !modal || contextClick;
      top.hide();
    }
  }

  #insideMenu(target: Node | null): boolean {
    return target !== null && this.topContent.contains(target);
  }

  protected override closed(): void {
    this.#openings++;
    this.anchorElement?.removeAttribute("aria-controls");
    this.menu?.destroy();
    this.menu = undefined;
    this.setAttribute("data-ui-menu-content", "");
    this.#layer?.();
    this.#layer = undefined;
    this.#unmodal?.();
    this.#unmodal = undefined;
    for (const sub of this.querySelectorAll<MenuSubElement>("[data-ui-menu-sub]")) sub.unbind();
    for (const sub of this.querySelectorAll<MenuContentElement>("[data-sub][open]")) sub.hide();

    if (this.isSub) {
      if (this.contains(document.activeElement)) this.anchorElement?.focus({ preventScroll: true });
      return;
    }
    const target = this.menuRoot?.returnTarget() ?? this.anchorElement;
    const tab = this.exitTab;
    const interacted = this.interactedOutside;
    this.exitTab = null;
    this.interactedOutside = false;
    if (!target?.isConnected) return;
    if (tab) return void this.#tabOut(target, tab === "backward");
    if (interacted) return;
    const active = document.activeElement;
    // Do not steal focus from something that took it meanwhile (a dialog an item opened).
    const free =
      !active ||
      active === document.body ||
      active === document.documentElement ||
      this.contains(active) ||
      active.contains(target);
    if (free) target.focus({ preventScroll: true });
  }

  /** Tab leaves the menu: focus continues from the trigger in the direction of the key. */
  #tabOut(from: HTMLElement, backward: boolean): void {
    from.focus({ preventScroll: true });
    import("@jcsoftdev/ui-core/focus").then(({ getTabbables }) => {
      const order = getTabbables(document.body).filter((node) => !this.contains(node));
      const index = order.indexOf(from);
      const next = order[index + (backward ? -1 : 1)];
      if (index >= 0 && next) next.focus({ preventScroll: true });
    });
  }
}

/** A sub-menu's content: opens beside its trigger. */
export class MenuSubContentElement extends MenuContentElement {
  protected override isSub = true;
  protected override defaultAlign = "start" as const;

  protected override connected(): void {
    this.defaultSide = getComputedStyle(this).direction === "rtl" ? "left" : "right";
    super.connected();
  }
}

// --- parts ---------------------------------------------------------------------------------

type ItemKind = "item" | "checkbox-item" | "radio-item" | "sub-trigger";

/**
 * Item parts. Attributes: `disabled`, `text-value` (typeahead text), `checked` (checkbox: also
 * `mixed`; radio: set by the group), `value` (radio), `tone="danger"`. A `select` event fires when
 * it is chosen (cancelable: preventing it keeps the menu open); a checkbox also fires `change`.
 */
export abstract class MenuItemElement extends ElementBase {
  static observedAttributes = ["disabled", "checked", "text-value"];

  protected abstract readonly kind: ItemKind;
  protected abstract readonly itemRole: string;

  connectedCallback(): void {
    this.setAttribute("data-ui-part", this.kind);
    this.setAttribute("role", this.itemRole);
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.build();
    this.sync();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync();
  }

  protected build(): void {}

  protected sync(): void {
    const disabled = this.hasAttribute("disabled");
    this.toggleAttribute("data-disabled", disabled);
    if (disabled) this.setAttribute("aria-disabled", "true");
    else this.removeAttribute("aria-disabled");
    const text = this.getAttribute("text-value");
    if (text !== null) this.setAttribute("data-text-value", text);
  }
}

export class MenuPlainItem extends MenuItemElement {
  protected readonly kind = "item";
  protected readonly itemRole = "menuitem";
}

const checkedOf = (element: Element): boolean | "indeterminate" => {
  const value = element.getAttribute("checked");
  if (value === "mixed" || value === "indeterminate") return "indeterminate";
  return value !== null && value !== "false";
};

function reflectChecked(element: HTMLElement, state: boolean | "indeterminate"): void {
  element.setAttribute("aria-checked", state === "indeterminate" ? "mixed" : String(state));
  element.setAttribute(
    "data-state",
    state === "indeterminate" ? "indeterminate" : state ? "checked" : "unchecked",
  );
}

export class MenuCheckboxItem extends MenuItemElement {
  protected readonly kind = "checkbox-item";
  protected readonly itemRole = "menuitemcheckbox";

  constructor() {
    super();
    this.addEventListener("ui.menu.itemSelect", (event) => {
      if ((event as CustomEvent<MenuSelectDetail>).detail.item !== this) return;
      const checked = this.getAttribute("aria-checked") === "true";
      this.toggleAttribute("checked", checked);
      emit(this, "change", { checked });
    });
  }

  protected override build(): void {
    if (this.querySelector(":scope > [data-ui-part=indicator]")) return;
    const indicator = document.createElement("span");
    indicator.setAttribute("data-ui-part", "indicator");
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = CHECK;
    this.prepend(indicator);
  }

  protected override sync(): void {
    super.sync();
    reflectChecked(this, checkedOf(this));
  }
}

export class MenuRadioItem extends MenuItemElement {
  protected readonly kind = "radio-item";
  protected readonly itemRole = "menuitemradio";

  protected override sync(): void {
    super.sync();
    reflectChecked(this, this.hasAttribute("checked"));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.closest<MenuRadioGroup>("[data-ui-menu-radio-group]")?.sync();
  }
}

export class MenuSubTrigger extends MenuItemElement {
  protected readonly kind = "sub-trigger";
  protected readonly itemRole = "menuitem";

  protected override build(): void {
    this.setAttribute("aria-haspopup", "menu");
    if (!this.hasAttribute("aria-expanded")) this.setAttribute("aria-expanded", "false");
    if (!this.querySelector(":scope > [data-ui-part=chevron]"))
      this.insertAdjacentHTML("beforeend", CHEVRON);
  }
}

/** Group of radio items: `value` is the chosen item's `value`. Fires `change` with `{ value }`. */
export class MenuRadioGroup extends ElementBase {
  static observedAttributes = ["value"];

  constructor() {
    super();
    this.addEventListener("ui.menu.itemSelect", (event) => {
      const { item } = (event as CustomEvent<MenuSelectDetail>).detail;
      if (
        item.getAttribute("role") !== "menuitemradio" ||
        item.closest("[data-ui-menu-radio-group]") !== this
      )
        return;
      const value = item.getAttribute("value") ?? (item.textContent ?? "").trim();
      this.setAttribute("value", value);
      emit(this, "change", { value });
    });
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    this.setAttribute("value", value);
  }

  connectedCallback(): void {
    this.setAttribute("data-ui-menu-radio-group", "");
    this.setAttribute("role", "group");
    this.sync();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync();
  }

  sync(): void {
    const value = this.getAttribute("value");
    for (const item of this.querySelectorAll<HTMLElement>("[data-ui-part=radio-item]"))
      if (item.closest("[data-ui-menu-radio-group]") === this)
        item.toggleAttribute("checked", value !== null && item.getAttribute("value") === value);
  }
}

/** Static parts: `label`, `separator`, `shortcut` and a labelled `group`. */
export abstract class MenuStaticPart extends ElementBase {
  protected abstract readonly kind: "label" | "separator" | "shortcut" | "group";

  connectedCallback(): void {
    this.setAttribute("data-ui-part", this.kind);
    if (this.kind === "separator") {
      this.setAttribute("role", "separator");
      this.setAttribute("aria-orientation", "horizontal");
    } else if (this.kind === "group") {
      this.setAttribute("role", "group");
      const label = this.querySelector(":scope > [data-ui-part=label]");
      if (label) this.setAttribute("aria-labelledby", ensureId(label, "menu-label"));
    } else if (this.kind === "shortcut") this.setAttribute("aria-hidden", "true");
  }
}
export class MenuLabel extends MenuStaticPart {
  protected readonly kind = "label";
}
export class MenuSeparator extends MenuStaticPart {
  protected readonly kind = "separator";
}
export class MenuShortcut extends MenuStaticPart {
  protected readonly kind = "shortcut";
}
export class MenuGroup extends MenuStaticPart {
  protected readonly kind = "group";
}

/** Wraps a sub-menu trigger and its content; binds the hover/keyboard behaviour while the parent is open. */
export class MenuSubElement extends ElementBase {
  #unbind: (() => void) | undefined;

  constructor() {
    super();
    const sync = (event: Event) => {
      const content = this.content;
      if (event.target !== content) return;
      const open = event.type === "open";
      this.trigger?.setAttribute("aria-expanded", String(open));
      this.trigger?.setAttribute("data-state", open ? "open" : "closed");
    };
    this.addEventListener("open", sync);
    this.addEventListener("close", sync);
  }

  get trigger(): HTMLElement | null {
    return this.querySelector<HTMLElement>(":scope > [data-ui-part=sub-trigger]");
  }
  get content(): MenuContentElement | null {
    return this.querySelector<MenuContentElement>(`:scope > ${CONTENT}`);
  }

  connectedCallback(): void {
    this.setAttribute("data-ui-menu-sub", "");
    this.style.display = "contents";
  }

  disconnectedCallback(): void {
    this.unbind();
  }

  bind(parent: MenuContent): void {
    this.unbind();
    const trigger = this.trigger;
    const content = this.content;
    if (!trigger || !content) return;
    this.#unbind = bindSubmenuTrigger(trigger, {
      parent,
      getContent: () => (content.open ? content : null),
      isOpen: () => content.open,
      setOpen: (open, intent) => (open ? content.openAt(trigger, intent) : content.hide()),
      disabled: () => trigger.hasAttribute("data-disabled"),
    });
  }

  unbind(): void {
    this.#unbind?.();
    this.#unbind = undefined;
  }
}

/** Registers the parts of a menu family under `<prefix>-<menu>-*` and returns nothing. */
export function defineMenuParts(
  menu: string,
  content: CustomElementConstructor,
  options?: DefineOptions,
): void {
  const parts: [string, CustomElementConstructor][] = [
    ["content", content],
    ["item", MenuPlainItem],
    ["checkbox-item", MenuCheckboxItem],
    ["radio-group", MenuRadioGroup],
    ["radio-item", MenuRadioItem],
    ["label", MenuLabel],
    ["separator", MenuSeparator],
    ["shortcut", MenuShortcut],
    ["group", MenuGroup],
    ["sub", MenuSubElement],
    ["sub-trigger", MenuSubTrigger],
    ["sub-content", MenuSubContentElement],
  ];
  for (const [name, ctor] of parts) defineElement(`${menu}-${name}`, ctor, options);
}
