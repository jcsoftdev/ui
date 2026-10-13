import type { Align, Side } from "@jcsoftdev/ui-core/popper";
import { autoPosition } from "@jcsoftdev/ui-core/popper";
import { byId, ElementBase, emit, hasPopover } from "./base.js";
import { MATERIAL_ATTRIBUTES, Material } from "./material.js";

const SIDES = new Set(["top", "right", "bottom", "left"]);
const ALIGNS = new Set(["start", "center", "end"]);

/** The invoker of a popover: the event source when the engine reports it, else a matching trigger. */
function findTrigger(host: HTMLElement, source: Element | null | undefined): HTMLElement | null {
  if (source instanceof HTMLElement) return source;
  if (!host.id) return null;
  const root = host.getRootNode() as Document | ShadowRoot;
  return root.querySelector<HTMLElement>(
    `[popovertarget="${CSS.escape(host.id)}"], [commandfor="${CSS.escape(host.id)}"]`,
  );
}

/**
 * Shared positioning for the anchored overlays (popover, tooltip): the host is a Popover API
 * element (top layer, no z-index wars) placed next to its anchor with ui-core's `autoPosition`
 * while open. Subclasses decide when it opens.
 */
export abstract class AnchoredOverlay extends ElementBase {
  static observedAttributes = [
    "open",
    "anchor",
    "side",
    "align",
    "side-offset",
    ...MATERIAL_ATTRIBUTES,
  ];

  protected anchorElement: HTMLElement | null = null;
  #stopPosition: (() => void) | undefined;
  protected readonly material = new Material(this, () => this);
  protected abstract readonly popoverMode: "auto" | "manual";
  protected abstract readonly defaultOffset: number;
  protected defaultSide: Side = "bottom";
  protected defaultAlign: Align = "center";
  protected arrow(): HTMLElement | null {
    return null;
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    this.toggleAttribute("open", value);
  }
  /** Places the open overlay again (the anchor moved). No-op while closed. */
  reposition(): void {
    if (this.#active) this.#place();
  }
  show(anchor?: HTMLElement | null): void {
    if (anchor) this.anchorElement = anchor;
    this.open = true;
  }
  hide(): void {
    this.open = false;
  }
  toggle(anchor?: HTMLElement | null): void {
    if (this.open) this.hide();
    else this.show(anchor);
  }

  protected connected(): void {}
  protected opened(): void {}
  protected closed(): void {}
  /**
   * Hides the element: call `hide` now (the default), or later to let an exit animation play
   * (`waitForExit` from ui-core's presence). Returns a cancel for a pending hide, called when the
   * overlay reopens or disconnects first.
   */
  protected exit(hide: () => void): (() => void) | undefined {
    hide();
    return undefined;
  }

  /** Set once connected: on upgrade, attribute callbacks run before `connectedCallback`. */
  #ready = false;

  connectedCallback(): void {
    if (hasPopover()) this.setAttribute("popover", this.popoverMode);
    else this.hidden = !this.open;
    this.connected();
    this.#ready = true;
    this.#sync();
    this.material.sync();
  }

  disconnectedCallback(): void {
    this.#ready = false;
    this.#cancelExit?.();
    this.#cancelExit = undefined;
    // Removing a showing popover hides it without toggle events: settle the state here, keeping
    // the `open` attribute so a reconnect (a move) shows it again.
    if (this.#active) {
      this.#active = false;
      this.#stop();
      this.closed();
    }
    this.material.stop();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#ready) return;
    if (name === "anchor") {
      this.anchorElement = byId(this, this.getAttribute("anchor")) ?? this.anchorElement;
      if (this.#stopPosition) this.#place();
    } else if (name === "open") this.#sync();
    else if (MATERIAL_ATTRIBUTES.includes(name as (typeof MATERIAL_ATTRIBUTES)[number]))
      this.material.sync();
    else if (this.#stopPosition) this.#place();
  }

  /**
   * Native toggles (an invoker, light dismiss, Escape) keep the `open` attribute in step. The
   * element stays invisible (`data-placing`) from `beforetoggle` until it is placed, so its first
   * frame never shows at a stale position.
   */
  protected onNativeToggle(event: Event): void {
    const { newState, source } = event as ToggleEvent & { source?: Element | null };
    if (event.type === "beforetoggle") {
      if (newState === "open") {
        this.anchorElement = findTrigger(this, source) ?? this.anchorElement;
        this.toggleAttribute("data-placing", true);
      }
      return;
    }
    this.open = newState === "open";
  }

  #active = false;
  #cancelExit: (() => void) | undefined;

  #sync(): void {
    const native = hasPopover();
    const showing = () => (native ? this.matches(":popover-open") : !this.hidden);
    if (this.open && !this.#active) {
      this.#cancelExit?.();
      this.#cancelExit = undefined;
      this.anchorElement ??= byId(this, this.getAttribute("anchor")) ?? findTrigger(this, null);
      if (!showing()) {
        if (native) this.showPopover();
        else this.hidden = false;
      }
      this.#active = true;
      this.#place();
      this.removeAttribute("data-placing");
      this.opened();
      emit(this, "open");
    } else if (!this.open && this.#active) {
      this.#active = false;
      this.#cancelExit = this.exit(() => {
        this.#cancelExit = undefined;
        if (showing()) {
          if (native) this.hidePopover();
          else this.hidden = true;
        }
        this.#stop();
      });
      this.closed();
      emit(this, "close");
    }
  }

  #place(): void {
    this.#stopPosition?.();
    const anchor = this.anchorElement;
    if (!anchor) return;
    const side = this.getAttribute("side") ?? "";
    const align = this.getAttribute("align") ?? "";
    const offset = Number.parseFloat(this.getAttribute("side-offset") ?? "");
    this.#stopPosition = autoPosition(anchor, this, {
      side: SIDES.has(side) ? (side as Side) : this.defaultSide,
      align: ALIGNS.has(align) ? (align as Align) : this.defaultAlign,
      sideOffset: Number.isFinite(offset) ? offset : this.defaultOffset,
      collisionPadding: 8,
      arrow: this.arrow(),
    });
  }

  #stop(): void {
    this.#stopPosition?.();
    this.#stopPosition = undefined;
  }
}
