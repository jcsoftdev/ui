import { createTypeahead, nextTypeaheadIndex } from "./typeahead.ts";

/**
 * Framework-free listbox behaviour (WAI-ARIA listbox pattern, with the filtering and
 * `aria-activedescendant` model of the React kit's command menu). It backs select, combobox,
 * inline-select and command-palette elements.
 *
 * Two independent models live side by side:
 * - the **active** option is the one keys act on. It carries `data-active`, and the controller
 *   points `aria-activedescendant` at it (or receives DOM focus in `focusMode: "focus"`);
 * - the **selection** is the set of chosen values. Chosen options carry `aria-selected="true"`.
 *
 * Markup contract: options are `[role="option"]` with an optional `data-value` (default: the text
 * content), `data-keywords` (space separated) and `aria-disabled="true"`/`data-disabled`. Groups
 * are `[role="group"]` and are hidden while none of their options is visible.
 */

export type ListboxMove = "next" | "prev" | "first" | "last" | "pageNext" | "pagePrev";

/** Returns 0 to hide an option, higher to rank it first. */
export type ListboxFilter = (value: string, search: string, keywords: readonly string[]) => number;

/** Case-insensitive substring filter. Pass `commandScore` from `@jcsoftdev/ui-core/command-score` for fuzzy ranking. */
export const includesFilter: ListboxFilter = (value, search, keywords) =>
  `${value} ${keywords.join(" ")}`.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;

// --- pure selection model --------------------------------------------------------------------

/** The next selection after the user chose `value`. */
export function selectValue(
  selection: readonly string[],
  value: string,
  multiple: boolean,
): string[] {
  if (!multiple) return [value];
  return selection.includes(value)
    ? selection.filter((entry) => entry !== value)
    : [...selection, value];
}

/** The values from `from` to `to` inclusive, in list order (Shift+Arrow range selection). */
export function rangeBetween(values: readonly string[], from: string, to: string): string[] {
  const a = values.indexOf(from);
  const b = values.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return values.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/**
 * Index of the option to activate after `move` among `count` enabled options. `current` is -1
 * when nothing is active. Without `loop` the ends clamp.
 */
export function moveActiveIndex(
  count: number,
  current: number,
  move: ListboxMove,
  { loop = false, pageSize = 10 }: { loop?: boolean; pageSize?: number } = {},
): number {
  if (count === 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  const step =
    move === "pageNext" ? pageSize : move === "pagePrev" ? -pageSize : move === "next" ? 1 : -1;
  if (current < 0)
    return step > 0 ? (move === "next" ? 0 : Math.min(pageSize - 1, count - 1)) : count - 1;
  const next = current + step;
  if (next >= 0 && next < count) return next;
  if (Math.abs(step) === 1 && loop) return (next + count) % count;
  return next < 0 ? 0 : count - 1;
}

// --- DOM behaviour --------------------------------------------------------------------------

export interface ListboxOptions {
  /** Element receiving keys and holding `aria-activedescendant`, e.g. a combobox input. Default: the root. */
  controller?: HTMLElement;
  /** `activedescendant` (default) keeps DOM focus on the controller; `focus` moves it to the option (roving tabindex). */
  focusMode?: "activedescendant" | "focus";
  multiple?: boolean;
  /** Wrap from the last option to the first and back. Default false. */
  loop?: boolean;
  /** Selecting follows the active option (single selection, APG "selection follows focus"). Default false. */
  selectionFollowsFocus?: boolean;
  /** Ctrl+N/P/J/K move like ArrowDown/ArrowUp. Default false. */
  vimBindings?: boolean;
  /** Initial selection. */
  defaultValue?: readonly string[];
  /** Filters and ranks options by the search text. Default: {@link includesFilter}. */
  filter?: ListboxFilter;
  /** Set false to render options as given (server-side search). Default true. */
  shouldFilter?: boolean;
  /** Reorder visible options by score while searching. Default false. */
  sort?: boolean;
  /** Options per PageUp/PageDown. Default 10. */
  pageSize?: number;
  /** Plain typeahead on printable keys (when the controller is not a text field). Default true. */
  typeahead?: boolean;
  onValueChange?: (value: string[]) => void;
  onActiveChange?: (option: HTMLElement | undefined) => void;
  /** Called when an option is chosen with Enter or a click (after the selection changed). */
  onChoose?: (option: HTMLElement, value: string) => void;
}

export interface Listbox {
  /** The selected values. */
  readonly value: readonly string[];
  readonly search: string;
  readonly active: HTMLElement | undefined;
  /** Number of visible options after the last filter pass. */
  readonly count: number;
  /** Visible, enabled options in DOM order. */
  options(): HTMLElement[];
  setValue(value: readonly string[]): void;
  /** Chooses `value` the way a click does. */
  select(value: string): void;
  setActive(target: HTMLElement | string | undefined): void;
  move(move: ListboxMove): void;
  setSearch(search: string): void;
  /** Re-reads the options after they were added, removed or changed. */
  refresh(): void;
  destroy(): void;
}

const OPTION = '[role="option"]';
let uid = 0;

const optionValue = (option: HTMLElement) =>
  option.dataset.value ?? (option.textContent ?? "").trim();
const keywordsOf = (option: HTMLElement) =>
  (option.dataset.keywords ?? "").split(/\s+/).filter(Boolean);
const isDisabled = (option: HTMLElement) =>
  option.hasAttribute("data-disabled") || option.getAttribute("aria-disabled") === "true";

/** Wires a listbox on `root`. Returns a handle; call `destroy()` to unbind. */
export function createListbox(root: HTMLElement, options: ListboxOptions = {}): Listbox {
  const controller = options.controller ?? root;
  const focusMode = options.focusMode ?? "activedescendant";
  const multiple = options.multiple ?? false;
  const filter = options.filter ?? includesFilter;
  const shouldFilter = options.shouldFilter ?? true;
  const typeahead = createTypeahead();
  let selection: string[] = [...(options.defaultValue ?? [])];
  let search = "";
  let active: HTMLElement | undefined;
  let anchorValue: string | undefined;
  let count = 0;
  const scores = new Map<HTMLElement, number>();
  const rank = new Map<Element, number>();
  let typedAt = 0;

  if (!root.hasAttribute("role")) root.setAttribute("role", "listbox");
  if (multiple) root.setAttribute("aria-multiselectable", "true");

  const all = () => Array.from(root.querySelectorAll<HTMLElement>(OPTION));
  const visible = () => all().filter((option) => !option.hidden);
  const enabled = () => visible().filter((option) => !isDisabled(option));

  const reflectSelection = () => {
    for (const option of all()) {
      const selected = selection.includes(optionValue(option));
      option.setAttribute("aria-selected", String(selected));
      option.toggleAttribute("data-selected", selected);
    }
  };

  const commit = (next: string[]) => {
    selection = next;
    reflectSelection();
    options.onValueChange?.([...selection]);
  };

  const setActive = (target: HTMLElement | undefined) => {
    if (target === active) return;
    active?.removeAttribute("data-active");
    active = target;
    if (target) {
      if (!target.id) target.id = `ui-option-${++uid}`;
      target.setAttribute("data-active", "");
      if (focusMode === "focus") {
        for (const option of all()) option.tabIndex = option === target ? 0 : -1;
        target.focus({ preventScroll: true });
      } else {
        controller.setAttribute("aria-activedescendant", target.id);
      }
      target.scrollIntoView?.({ block: "nearest" });
    } else if (focusMode === "activedescendant") {
      controller.removeAttribute("aria-activedescendant");
    }
    options.onActiveChange?.(target);
  };

  const resolve = (target: HTMLElement | string | undefined) =>
    typeof target === "string"
      ? enabled().find((option) => optionValue(option) === target)
      : target;

  const move = (kind: ListboxMove, extend = false) => {
    const list = enabled();
    const index = moveActiveIndex(list.length, active ? list.indexOf(active) : -1, kind, {
      loop: options.loop,
      pageSize: options.pageSize,
    });
    const target = list[index];
    if (!target) return;
    setActive(target);
    if (multiple && extend) {
      const values = list.map(optionValue);
      anchorValue ??= optionValue(target);
      commit(rangeBetween(values, anchorValue, optionValue(target)));
    } else if (!multiple && options.selectionFollowsFocus) {
      commit([optionValue(target)]);
    }
  };

  const choose = (option: HTMLElement) => {
    if (isDisabled(option)) return;
    const value = optionValue(option);
    anchorValue = value;
    commit(selectValue(selection, value, multiple));
    options.onChoose?.(option, value);
  };

  /** Applies the filter to every option, hides misses, and optionally reorders by score. */
  const applyFilter = () => {
    const filtering = shouldFilter && search !== "";
    const groupBest = new Map<Element, number>();
    scores.clear();
    for (const option of all()) {
      const score = filtering ? filter(optionValue(option), search, keywordsOf(option)) : 1;
      scores.set(option, score);
      option.hidden = score <= 0;
      const group = option.closest('[role="group"]');
      if (group && score > 0) groupBest.set(group, Math.max(groupBest.get(group) ?? 0, score));
    }
    for (const group of root.querySelectorAll<HTMLElement>('[role="group"]'))
      group.hidden = filtering && !groupBest.has(group);
    count = Array.from(scores.values()).filter((score) => score > 0).length;
    if (options.sort) sortByScore(filtering, groupBest);
    if (!active || active.hidden || isDisabled(active)) setActive(enabled()[0]);
  };

  const sortByScore = (ranking: boolean, groupBest: Map<Element, number>) => {
    const nodes: Element[] = [...all(), ...root.querySelectorAll('[role="group"]')];
    for (const node of nodes) if (!rank.has(node)) rank.set(node, rank.size);
    const buckets = new Map<Element, Element[]>();
    for (const node of nodes) {
      const parent = node.parentElement;
      if (parent) buckets.set(parent, [...(buckets.get(parent) ?? []), node]);
    }
    const scoreOf = (node: Element) => scores.get(node as HTMLElement) ?? groupBest.get(node) ?? 0;
    for (const [parent, members] of buckets) {
      const slots = [...parent.children].filter((child) => members.includes(child));
      const sorted = [...members].sort(
        (a, b) =>
          (ranking ? scoreOf(b) - scoreOf(a) : 0) || (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
      );
      if (slots.every((child, i) => child === sorted[i])) continue;
      const markers = slots.map((child) => {
        const marker = document.createComment("");
        parent.insertBefore(marker, child);
        return marker;
      });
      for (const [i, node] of sorted.entries()) parent.insertBefore(node, markers[i] ?? null);
      for (const marker of markers) marker.remove();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (
      focusMode === "focus" &&
      !(event.target as Element).closest?.(OPTION) &&
      event.target !== root
    )
      return;
    const key = event.key;
    const vim = options.vimBindings === true && event.ctrlKey;
    const extend = event.shiftKey && multiple;
    let handled = true;
    if (key === "ArrowDown" || (vim && (key === "n" || key === "j"))) {
      if (event.metaKey) move("last");
      else move("next", extend);
    } else if (key === "ArrowUp" || (vim && (key === "p" || key === "k"))) {
      if (event.metaKey) move("first");
      else move("prev", extend);
    } else if (key === "Home") move("first", extend);
    else if (key === "End") move("last", extend);
    else if (key === "PageDown") move("pageNext");
    else if (key === "PageUp") move("pagePrev");
    else if (
      key === "Enter" ||
      (key === " " && !isTextField(event.target) && Date.now() - typedAt > 1000)
    ) {
      if (active) choose(active);
    } else if (
      multiple &&
      key === "a" &&
      (event.ctrlKey || event.metaKey) &&
      !isTextField(event.target)
    ) {
      commit(enabled().map(optionValue));
    } else if (
      options.typeahead !== false &&
      !isTextField(event.target) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      key.length === 1 &&
      (key !== " " || Date.now() - typedAt <= 1000)
    ) {
      const typed = typeahead.key(key);
      if (typed !== undefined) typedAt = Date.now();
      handled = false;
      if (typed !== undefined) {
        const list = enabled();
        const index = nextTypeaheadIndex(
          list.map((option) => (option.dataset.textValue ?? option.textContent ?? "").trim()),
          typed,
          active ? list.indexOf(active) : -1,
        );
        if (index >= 0) {
          setActive(list[index]);
          if (!multiple && options.selectionFollowsFocus && list[index])
            commit([optionValue(list[index])]);
          handled = true;
        }
      }
    } else handled = false;
    if (handled) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    const option = (event.target as Element).closest?.<HTMLElement>(OPTION);
    if (!option || !root.contains(option)) return;
    setActive(option);
    choose(option);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const option = (event.target as Element).closest?.<HTMLElement>(OPTION);
    if (option && !isDisabled(option)) setActive(option);
  };
  // Keep DOM focus on the controller when the pointer presses an option.
  const onPointerDown = (event: PointerEvent) => {
    if (
      focusMode === "activedescendant" &&
      controller !== root &&
      root.contains(event.target as Node)
    )
      event.preventDefault();
  };

  controller.addEventListener("keydown", onKeyDown);
  root.addEventListener("click", onClick);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerdown", onPointerDown);
  reflectSelection();
  applyFilter();
  const firstSelected = enabled().find((option) => selection.includes(optionValue(option)));
  if (firstSelected) setActive(firstSelected);

  return {
    get value() {
      return selection;
    },
    get search() {
      return search;
    },
    get active() {
      return active;
    },
    get count() {
      return count;
    },
    options: enabled,
    setValue(value) {
      selection = [...value];
      reflectSelection();
    },
    select(value) {
      const option = all().find((entry) => optionValue(entry) === value);
      if (option) choose(option);
    },
    setActive(target) {
      setActive(resolve(target));
    },
    move(kind) {
      move(kind);
    },
    setSearch(next) {
      if (next === search) return;
      search = next;
      applyFilter();
      setActive(enabled()[0]);
    },
    refresh() {
      reflectSelection();
      applyFilter();
    },
    destroy() {
      controller.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
      active?.removeAttribute("data-active");
      controller.removeAttribute("aria-activedescendant");
      typeahead.reset();
    },
  };
}

function isTextField(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  return (
    node?.tagName === "INPUT" || node?.tagName === "TEXTAREA" || node?.isContentEditable === true
  );
}
