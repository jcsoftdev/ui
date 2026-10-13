/** Lowercase, accent-free key so "Áncash", "ancash" and "ANCASH" join. */
export function matchKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Looks a record up by the id or by the name of a region. */
export function createRegionIndex<T extends { id: string }>(items: readonly T[]) {
  const byKey = new Map<string, T>();
  for (const item of items) byKey.set(matchKey(item.id), item);
  return (feature: { id: string; name: string }): T | undefined =>
    byKey.get(matchKey(feature.id)) ?? byKey.get(matchKey(feature.name));
}
