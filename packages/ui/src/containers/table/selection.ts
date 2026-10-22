export type SelectAllState = boolean | "indeterminate";

/** Adds the key when absent, removes it when present. Order of the other keys is kept. */
export function toggleKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((current) => current !== key) : [...keys, key];
}

/** Adds (`on`) or removes (`!on`) many keys at once, without duplicates. */
export function setKeys(keys: readonly string[], many: readonly string[], on: boolean): string[] {
  return on ? [...new Set([...keys, ...many])] : keys.filter((current) => !many.includes(current));
}

/** `true` when every visible key is selected, `"indeterminate"` when only some are, else `false`. */
export function selectAllState(
  keys: readonly string[],
  visible: readonly string[],
): SelectAllState {
  const count = visible.filter((key) => keys.includes(key)).length;
  if (visible.length > 0 && count === visible.length) return true;
  return count > 0 ? "indeterminate" : false;
}

/** Fills `{row}` in a "Select {row}" template. */
export function formatSelectRow(template: string, row: string): string {
  return template.replace("{row}", row).trim();
}
