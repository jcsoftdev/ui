/** One emoji and its searchable name (a display name followed by keywords). */
export interface EmojiEntry {
  emoji: string;
  name: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  /** Emoji shown on the category tab. */
  icon: string;
  emojis: EmojiEntry[];
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Entries whose name contains every word of the query, across all categories, accents and case
 * ignored. An emoji listed in several categories is returned once. Same maths as the React kit.
 */
export function searchEmojis(categories: readonly EmojiCategory[], query: string): EmojiEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const seen = new Set<string>();
  const found: EmojiEntry[] = [];
  for (const category of categories) {
    for (const entry of category.emojis) {
      if (seen.has(entry.emoji)) continue;
      const haystack = normalize(entry.name);
      if (words.every((word) => haystack.includes(word))) {
        seen.add(entry.emoji);
        found.push(entry);
      }
    }
  }
  return found;
}

/**
 * Next index in a grid of `count` cells and `columns` columns for an arrow/Home/End key. Vertical
 * moves that would leave the grid stay in place; the last row may be short.
 */
export function gridMove(key: string, index: number, columns: number, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
      return Math.min(last, index + 1);
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowDown":
      return index + columns <= last ? index + columns : index;
    case "ArrowUp":
      return index - columns >= 0 ? index - columns : index;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return index;
  }
}
