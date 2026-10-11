/**
 * Fuzzy scoring for command palettes. DOM-free and pure.
 *
 * A character-by-character matcher in the style of `command-score`: every character of
 * the search must appear in order in the candidate. Matches that continue a run, start a
 * word or follow a separator score higher; skipped characters, case mismatches and an
 * incomplete tail cost a little. Returns 0 when the search cannot be matched, otherwise a
 * number in (0, 1] where higher is better.
 */

const SCORE_CONTINUE_MATCH = 1;
const SCORE_SPACE_WORD_JUMP = 0.9;
const SCORE_NON_SPACE_WORD_JUMP = 0.8;
const SCORE_CHARACTER_JUMP = 0.17;
const SCORE_TRANSPOSITION = 0.1;
const PENALTY_SKIPPED = 0.999;
const PENALTY_CASE_MISMATCH = 0.9999;
const PENALTY_NOT_COMPLETE = 0.99;

const IS_GAP = /[\\/_+.#"@[({&]/;
const COUNT_GAPS = /[\\/_+.#"@[({&]/g;
const IS_SPACE = /[\s-]/;
const COUNT_SPACE = /[\s-]/g;

function normalise(text: string): string {
  return text.toLowerCase().replace(COUNT_SPACE, " ");
}

function scoreFrom(
  text: string,
  search: string,
  lowerText: string,
  lowerSearch: string,
  textIndex: number,
  searchIndex: number,
  memo: Map<number, number>,
): number {
  if (searchIndex === search.length) {
    return textIndex === text.length ? SCORE_CONTINUE_MATCH : PENALTY_NOT_COMPLETE;
  }
  const key = textIndex * (search.length + 1) + searchIndex;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const searchChar = lowerSearch.charAt(searchIndex);
  let index = lowerText.indexOf(searchChar, textIndex);
  let best = 0;

  while (index >= 0) {
    let score = scoreFrom(text, search, lowerText, lowerSearch, index + 1, searchIndex + 1, memo);
    if (score > best) {
      if (index === textIndex) {
        score *= SCORE_CONTINUE_MATCH;
      } else if (IS_GAP.test(text.charAt(index - 1))) {
        score *= SCORE_NON_SPACE_WORD_JUMP;
        const breaks = text.slice(textIndex, index - 1).match(COUNT_GAPS);
        if (breaks && textIndex > 0) score *= PENALTY_SKIPPED ** breaks.length;
      } else if (IS_SPACE.test(text.charAt(index - 1))) {
        score *= SCORE_SPACE_WORD_JUMP;
        const breaks = text.slice(textIndex, index - 1).match(COUNT_SPACE);
        if (breaks && textIndex > 0) score *= PENALTY_SKIPPED ** breaks.length;
      } else {
        score *= SCORE_CHARACTER_JUMP;
        if (textIndex > 0) score *= PENALTY_SKIPPED ** (index - textIndex);
      }
      if (text.charAt(index) !== search.charAt(searchIndex)) score *= PENALTY_CASE_MISMATCH;
    }

    const next = lowerSearch.charAt(searchIndex + 1);
    const swapped = score < SCORE_TRANSPOSITION && lowerText.charAt(index - 1) === next;
    const doubled =
      next === lowerSearch.charAt(searchIndex) && lowerText.charAt(index - 1) !== searchChar;
    if (swapped || doubled) {
      const transposed = scoreFrom(
        text,
        search,
        lowerText,
        lowerSearch,
        index + 1,
        searchIndex + 2,
        memo,
      );
      if (transposed * SCORE_TRANSPOSITION > score) score = transposed * SCORE_TRANSPOSITION;
    }

    if (score > best) best = score;
    index = lowerText.indexOf(searchChar, index + 1);
  }

  memo.set(key, best);
  return best;
}

/**
 * Scores `search` against `value` plus optional `keywords`. An empty search matches
 * everything with score 1.
 */
export function commandScore(value: string, search: string, keywords?: readonly string[]): number {
  if (search === "") return 1;
  const text = keywords && keywords.length > 0 ? `${value} ${keywords.join(" ")}` : value;
  return scoreFrom(text, search, normalise(text), normalise(search), 0, 0, new Map());
}

export type CommandFilter = (value: string, search: string, keywords?: readonly string[]) => number;
