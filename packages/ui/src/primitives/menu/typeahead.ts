/**
 * Index of the item a typeahead `search` should focus, or -1. A repeated single
 * character ("aaa") cycles through items starting with it, beginning after
 * `currentIndex`; a longer search keeps the current item when it still matches.
 */
export function nextTypeaheadIndex(
  values: readonly string[],
  search: string,
  currentIndex: number,
): number {
  if (search === "" || values.length === 0) return -1;
  const repeated = search.length > 1 && [...search].every((char) => char === search[0]);
  const needle = (repeated ? (search[0] as string) : search).toLowerCase();
  const cycle = needle.length === 1;
  const start = Math.max(currentIndex, 0);
  for (let step = 0; step < values.length; step++) {
    const index = (start + step) % values.length;
    if (cycle && index === currentIndex) continue;
    if ((values[index] as string).toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
