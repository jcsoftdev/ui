/** Pure rules shared by `SelectMenu` and `Combobox`: option shapes, navigation, typeahead and filtering. */

export interface ListboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Extra words matched by a `Combobox` search, never shown. */
  keywords?: string;
}

export interface ListboxGroup<O extends ListboxOption = ListboxOption> {
  label: string;
  options: O[];
}

export type ListboxItem<O extends ListboxOption = ListboxOption> = O | ListboxGroup<O>;

export function isGroup<O extends ListboxOption>(item: ListboxItem<O>): item is ListboxGroup<O> {
  return "options" in item;
}

/** Options in display order with the group headings removed. */
export function flattenItems<O extends ListboxOption>(items: readonly ListboxItem<O>[]): O[] {
  return items.flatMap((item) => (isGroup(item) ? item.options : [item]));
}

export type ListboxMove = "next" | "prev" | "first" | "last";

/** Index of the enabled option a key moves to, or `current` when nothing is reachable. The list does not wrap. */
export function moveActive(
  options: readonly ListboxOption[],
  current: number,
  move: ListboxMove,
): number {
  const enabled = (index: number) => options[index] !== undefined && !options[index]?.disabled;
  if (move === "first") {
    for (let i = 0; i < options.length; i++) if (enabled(i)) return i;
    return current;
  }
  if (move === "last") {
    for (let i = options.length - 1; i >= 0; i--) if (enabled(i)) return i;
    return current;
  }
  const step = move === "next" ? 1 : -1;
  for (let i = current + step; i >= 0 && i < options.length; i += step) if (enabled(i)) return i;
  return current;
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/**
 * Option a typed prefix lands on. A single repeated character cycles through the options that
 * start with it; a longer prefix keeps matching from the active option.
 */
export function typeaheadIndex(
  options: readonly ListboxOption[],
  query: string,
  active: number,
): number {
  if (!query) return -1;
  const needle = fold(query);
  const repeated = needle.length > 1 && [...needle].every((char) => char === needle[0]);
  const search = repeated ? needle.slice(0, 1) : needle;
  const start = needle.length === 1 || repeated ? active + 1 : active;
  for (let offset = 0; offset < options.length; offset++) {
    const index = (start + offset + options.length) % options.length;
    const option = options[index];
    if (option && !option.disabled && fold(option.label).startsWith(search)) return index;
  }
  return -1;
}

/** Typeahead buffer: characters typed within `timeout` ms of each other form one prefix. */
export function nextTypeahead(
  state: { buffer: string; at: number },
  key: string,
  now: number,
  timeout = 600,
): { buffer: string; at: number } {
  const buffer = now - state.at > timeout ? key : state.buffer + key;
  return { buffer, at: now };
}

/** True for a key that types a character (not a shortcut or a named key). */
export function isTypeaheadKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/** Accent- and case-insensitive match against label, description and keywords. */
export function matchesQuery(option: ListboxOption, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return fold(`${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`).includes(
    needle,
  );
}

/** Keeps matching options, dropping groups left empty and capping the number of options shown. */
export function filterItems<O extends ListboxOption>(
  items: readonly ListboxItem<O>[],
  predicate: (option: O) => boolean,
  limit = Number.POSITIVE_INFINITY,
): ListboxItem<O>[] {
  let left = limit;
  const result: ListboxItem<O>[] = [];
  for (const item of items) {
    if (left <= 0) break;
    if (isGroup(item)) {
      const options = item.options.filter(predicate).slice(0, left);
      left -= options.length;
      if (options.length > 0) result.push({ ...item, options });
    } else if (predicate(item)) {
      result.push(item);
      left -= 1;
    }
  }
  return result;
}
