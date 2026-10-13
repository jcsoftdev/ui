import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import { adoptStyles, ElementBase, emit, isPart, rootOf } from "./base.js";
import { FormElement } from "./form.js";

type RefsElement = HTMLElement & {
  ariaLabelledByElements?: Element[] | null;
  ariaDescribedByElements?: Element[] | null;
};

/**
 * Wires a native control inside a shadow root to its host: the accessible name (`aria-label` or
 * `label` on the host, else the `<label>`s of the host), the description (`aria-describedby` on
 * the host, resolved in the host's own root and handed over as element references, which may cross
 * the shadow boundary) and `invalid`. Shared by `<ui-textarea>` and `<ui-native-select>`.
 */
export function syncControlAria(
  host: HTMLElement,
  control: HTMLElement,
  labels: NodeListOf<HTMLLabelElement> | readonly HTMLLabelElement[],
): void {
  const inner = control as RefsElement;
  const own = host.getAttribute("aria-label") ?? host.getAttribute("label");
  const hasRefs = "ariaLabelledByElements" in inner;
  if (own) {
    inner.setAttribute("aria-label", own);
    if (hasRefs) inner.ariaLabelledByElements = null;
  } else if (labels.length && hasRefs) {
    inner.removeAttribute("aria-label");
    inner.ariaLabelledByElements = [...labels];
  } else if (labels.length) {
    inner.setAttribute("aria-label", [...labels].map((l) => l.textContent?.trim()).join(" "));
  } else inner.removeAttribute("aria-label");

  const root = host.getRootNode() as Document | ShadowRoot;
  const described = (host.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .map((id) => (id ? root.getElementById?.(id) : null))
    .filter((element): element is HTMLElement => !!element);
  if (hasRefs) inner.ariaDescribedByElements = described.length ? described : null;

  if (host.hasAttribute("invalid")) inner.setAttribute("aria-invalid", "true");
  else inner.removeAttribute("aria-invalid");
}

/** Converts the host's validity into flags for `setValidity`, anchored on the inner control. */
export function innerValidity(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): { flags: ValidityStateFlags; message: string; anchor: HTMLElement } | undefined {
  if (control.validity.valid) return undefined;
  return {
    flags: control.validity as unknown as ValidityStateFlags,
    message: control.validationMessage,
    anchor: control,
  };
}

/**
 * One choice of a choice group (`role="radio"` or `"checkbox"` on the host, `aria-checked`).
 * Attributes: `value`, `disabled`. The group owns the selection and the tab stops.
 */
export abstract class ChoiceItem extends ElementBase {
  static observedAttributes: string[] = ["disabled", "value"];

  protected readonly internals = this.attachInternals();
  protected abstract readonly choiceRole: "radio" | "checkbox";
  protected abstract readonly template: string;
  protected abstract readonly css: string;

  constructor() {
    super();
    this.addEventListener("click", () => {
      if (!this.hasAttribute("data-disabled")) emit(this, "ui-choice-select");
    });
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: "open" });
      adoptStyles(root, this.css);
      root.innerHTML = this.template;
    }
    this.internals.role = this.choiceRole;
    this.sync(this.dataset.state === "checked", this.disabled);
    this.#notify();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#notify();
  }

  /** Called by the group: shows the checked and disabled state. */
  sync(checked: boolean, disabled: boolean): void {
    this.dataset.state = checked ? "checked" : "unchecked";
    this.toggleAttribute("data-disabled", disabled);
    this.internals.ariaChecked = String(checked);
    this.internals.ariaDisabled = disabled ? "true" : null;
    if (this.choiceRole === "checkbox") this.tabIndex = disabled ? -1 : 0;
  }

  #notify(): void {
    this.dispatchEvent(new Event("ui-choice-change", { bubbles: true }));
  }
}

/** The items of `group`: `isPart(item, part)` and not owned by a nested group. */
function itemsOf(group: HTMLElement, part: string, ui: string): ChoiceItem[] {
  return [...group.querySelectorAll<ChoiceItem>("*")].filter(
    (element) => isPart(element, part) && element.closest(`[data-ui="${ui}"]`) === group,
  );
}

/** Space selects the focused item, as it does on a native radio or checkbox. */
function onSpace(
  event: KeyboardEvent,
  items: () => ChoiceItem[],
  select: (item: ChoiceItem) => void,
) {
  if (event.key !== " ") return;
  const item = items().find((candidate) => candidate === event.target);
  if (!item) return;
  event.preventDefault();
  select(item);
}

/**
 * Light-DOM `radiogroup` of {@link ChoiceItem}s on the `FormElement` base: arrows move focus and
 * selection together (roving tabindex, one tab stop on the checked item), Space selects. It submits
 * `name=value`, is `valueMissing` when `required` and nothing is chosen, and `form.reset()`
 * restores the `value` attribute.
 */
export abstract class ChoiceGroup extends FormElement {
  protected abstract readonly ui: string;
  protected abstract readonly itemPart: string;
  protected abstract readonly css: string;
  #roving: RovingFocus | undefined;

  constructor() {
    super();
    this.internals.role = "radiogroup";
    this.addEventListener("ui-choice-select", (event) => {
      event.stopPropagation();
      this.#choose(event.target as ChoiceItem);
    });
    this.addEventListener("ui-choice-change", (event) => {
      event.stopPropagation();
      this.attributeChangedCallback("value");
    });
    this.addEventListener("keydown", (event) =>
      onSpace(
        event,
        () => this.items(),
        (item) => this.#choose(item),
      ),
    );
  }

  override get defaultValue(): string {
    return this.getAttribute("value") ?? this.fallbackValue();
  }

  /** The value used when there is no `value` attribute. */
  protected fallbackValue(): string {
    return "";
  }

  protected items(): ChoiceItem[] {
    return itemsOf(this, this.itemPart, this.ui);
  }

  override connectedCallback(): void {
    this.dataset.ui = this.ui;
    adoptStyles(rootOf(this), this.css);
    this.#roving ??= createRovingFocus(this, {
      items: () => this.items(),
      isDisabled: (item) => this.disabled || item.hasAttribute("disabled"),
      onNavigate: (target) => this.#choose(target as ChoiceItem),
    });
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.#roving?.destroy();
    this.#roving = undefined;
  }

  #choose(item: ChoiceItem): void {
    if (this.disabled || item.hasAttribute("disabled")) return;
    item.focus();
    this.commit(item.getAttribute("value") ?? "");
  }

  protected render(): void {
    let checked: ChoiceItem | undefined;
    for (const item of this.items()) {
      const on = this.value !== "" && item.getAttribute("value") === this.value;
      if (on) checked = item;
      item.sync(on, this.disabled || item.hasAttribute("disabled"));
    }
    this.#roving?.setActive(checked && !checked.hasAttribute("disabled") ? checked : undefined);
  }

  protected override validate() {
    const problem = super.validate();
    return (
      problem && {
        flags: problem.flags,
        message: "Select one of these options.",
        anchor: this.items()[0],
      }
    );
  }
}

export { itemsOf, onSpace };
