const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "el",
  "y",
  "e",
  "the",
  "of",
  "and",
  "&",
]);

function firstLetter(word: string): string {
  const first = [...word.normalize("NFC")][0] ?? "";
  if (first.toLowerCase() === "ñ") return "Ñ";
  return (first.normalize("NFD")[0] ?? "").toLocaleUpperCase("es");
}

function stripMarks(word: string): string {
  return [...word.normalize("NFC")]
    .map((char) =>
      char.toLowerCase() === "ñ" ? char : char.normalize("NFD").replace(/\p{M}/gu, ""),
    )
    .join("");
}

/**
 * Initials of a business name: first letter of each significant word, accents removed
 * (the Ñ is kept), articles and prepositions skipped. When the name has fewer words than
 * `count`, the first word lends its next letters ("Don Lucho" with 3 gives "DLO").
 */
export function getInitials(name: string, count = 2): string {
  const limit = Math.max(1, Math.min(3, Math.floor(count)));
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const significant = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;
  const letters = pool
    .map(firstLetter)
    .filter((l) => /[\p{L}\p{N}]/u.test(l))
    .slice(0, limit);
  const head = pool[0] ? stripMarks(pool[0]).toLocaleUpperCase("es") : "";
  let extra = 1;
  while (letters.length > 0 && letters.length < limit && extra < head.length) {
    letters.push(head[extra] ?? "");
    extra += 1;
  }
  return letters.join("");
}
