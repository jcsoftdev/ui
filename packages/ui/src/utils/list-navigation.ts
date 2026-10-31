export type ListNavigationKey = "ArrowUp" | "ArrowDown" | "Home" | "End";

const NAVIGATION_KEYS: readonly string[] = ["ArrowUp", "ArrowDown", "Home", "End"];

export function isListNavigationKey(key: string): key is ListNavigationKey {
  return NAVIGATION_KEYS.includes(key);
}

/**
 * The key a navigation key lands on, given the keys in DOM order and the current one.
 * Returns `undefined` for other keys, an unknown current key past the ends, or when nothing moves.
 */
export function listNavigationTarget(
  keys: readonly string[],
  current: string | null | undefined,
  key: string,
): string | undefined {
  if (!isListNavigationKey(key) || keys.length === 0) return undefined;
  const index = current == null ? -1 : keys.indexOf(current);
  let next: number;
  if (key === "Home") next = 0;
  else if (key === "End") next = keys.length - 1;
  else if (key === "ArrowDown") next = Math.min(keys.length - 1, index + 1);
  else next = index < 0 ? 0 : Math.max(0, index - 1);
  const target = keys[next];
  return target === current ? undefined : target;
}

const ROW_ATTR = "data-row-key";

function rowElements(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`)).filter(
    (el) => el.closest("[data-row-scope]") === container && el.getClientRects().length > 0,
  );
}

/**
 * Moves focus between the `data-row-key` rows of a `data-row-scope` container for a navigation
 * key. Returns the row focused, or `undefined` when the key is not handled.
 */
export function focusRowByKey(
  container: Element,
  current: Element,
  key: string,
): HTMLElement | undefined {
  const rows = rowElements(container);
  const keys = rows.map((row) => row.getAttribute(ROW_ATTR) ?? "");
  const from = current.getAttribute(ROW_ATTR);
  const target = listNavigationTarget(keys, from, key);
  if (target === undefined) return undefined;
  const row = rows[keys.indexOf(target)];
  row?.focus();
  return row;
}

/** Focuses the visible row whose `data-row-key` equals `key` under `root`; returns it. */
export function focusRowWithKey(root: Element, key: string): HTMLElement | undefined {
  const row = Array.from(root.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`)).find(
    (el) => el.getAttribute(ROW_ATTR) === key && el.getClientRects().length > 0,
  );
  row?.focus();
  return row;
}
