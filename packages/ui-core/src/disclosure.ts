export interface DisclosureOptions {
  trigger: HTMLElement;
  panel: HTMLElement;
  /** Initial state when uncontrolled. Default false. */
  defaultOpen?: boolean;
  /** Controlled state; `undefined` keeps the disclosure uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface Disclosure {
  readonly open: boolean;
  set(open: boolean): void;
  toggle(): void;
  /** The owner's value; `undefined` hands control back. */
  control(open: boolean | undefined): void;
  destroy(): void;
}

let counter = 0;

/**
 * Header button + collapsible panel: `aria-expanded` and `aria-controls` on the trigger, `inert`
 * on a closed panel (it leaves the tab order and the AX tree, like the React kit's `Disclosure`),
 * `data-state` on both. Animate with `grid-template-rows` on the panel's wrapper.
 */
export function createDisclosure(options: DisclosureOptions): Disclosure {
  const { trigger, panel } = options;
  let own = options.defaultOpen ?? false;
  let owner = options.open;
  const current = () => owner ?? own;

  if (!panel.id) panel.id = `ui-disclosure-${++counter}`;
  trigger.setAttribute("aria-controls", panel.id);
  if (trigger.tagName === "BUTTON" && !trigger.hasAttribute("type"))
    trigger.setAttribute("type", "button");

  const apply = () => {
    const open = current();
    trigger.setAttribute("aria-expanded", String(open));
    trigger.dataset.state = open ? "open" : "closed";
    panel.dataset.state = open ? "open" : "closed";
    panel.inert = !open;
  };

  const set = (next: boolean) => {
    if (next === current()) return;
    if (owner === undefined) {
      own = next;
      apply();
    }
    options.onOpenChange?.(next);
  };
  const onClick = () => set(!current());

  trigger.addEventListener("click", onClick);
  apply();
  return {
    get open() {
      return current();
    },
    set,
    toggle: () => set(!current()),
    control(open) {
      owner = open;
      apply();
    },
    destroy() {
      trigger.removeEventListener("click", onClick);
    },
  };
}
