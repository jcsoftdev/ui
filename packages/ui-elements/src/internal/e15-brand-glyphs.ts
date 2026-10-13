export type GlyphId =
  | "scissors"
  | "comb"
  | "razor"
  | "pole"
  | "star"
  | "leaf"
  | "bolt"
  | "crown"
  | "mustache";

export interface GlyphPart {
  d: string;
  /** `fill` parts are solid; `stroke` parts are 2-unit round-capped lines. */
  kind: "fill" | "stroke";
}

export interface Glyph {
  id: GlyphId;
  label: string;
  /** Paths drawn in a 24 x 24 box. */
  parts: GlyphPart[];
}

/** Our own simple geometric paths; no third-party icon data. */
export const GLYPHS: readonly Glyph[] = [
  {
    id: "scissors",
    label: "Tijeras",
    parts: [
      { kind: "stroke", d: "M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z" },
      { kind: "stroke", d: "M21 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z" },
      { kind: "stroke", d: "M8.1 15.9L19 4" },
      { kind: "stroke", d: "M15.9 15.9L5 4" },
    ],
  },
  {
    id: "comb",
    label: "Peine",
    parts: [
      { kind: "fill", d: "M3 4h18v6H3z" },
      { kind: "stroke", d: "M5 10v10M8.5 10v10M12 10v10M15.5 10v10M19 10v10" },
    ],
  },
  {
    id: "razor",
    label: "Navaja",
    parts: [
      { kind: "fill", d: "M3 6h13l5 5H3z" },
      { kind: "stroke", d: "M3 16h18" },
      { kind: "stroke", d: "M3 20h10" },
    ],
  },
  {
    id: "pole",
    label: "Poste",
    parts: [
      { kind: "fill", d: "M7 2h10v3H7z" },
      { kind: "fill", d: "M7 19h10v3H7z" },
      { kind: "stroke", d: "M8.5 5v14M15.5 5v14" },
      { kind: "stroke", d: "M8.5 8.5l7-3M8.5 13.5l7-3M8.5 18.5l7-3" },
    ],
  },
  {
    id: "star",
    label: "Estrella",
    parts: [
      {
        kind: "fill",
        d: "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z",
      },
    ],
  },
  {
    id: "leaf",
    label: "Hoja",
    parts: [
      {
        kind: "fill",
        d: "M20 4C10 4 4 9 4 15c0 2 1 4 2.5 5C6 15 9 11 14 9c-4 3-6 6-6.5 11.5C16 20 20 13 20 4z",
      },
    ],
  },
  {
    id: "bolt",
    label: "Rayo",
    parts: [{ kind: "fill", d: "M13 2L4 14h6l-1 8 9-12h-6z" }],
  },
  {
    id: "crown",
    label: "Corona",
    parts: [
      { kind: "fill", d: "M3 18l-1-11 5 4 5-7 5 7 5-4-1 11z" },
      { kind: "fill", d: "M4 20h16v2H4z" },
    ],
  },
  {
    id: "mustache",
    label: "Bigote",
    parts: [
      {
        kind: "fill",
        d: "M12 9.5C10 7.5 6 7.5 3 10c.5 4 5 6 9 3.5 4 2.5 8.5.5 9-3.5-3-2.5-7-2.5-9-.5z",
      },
    ],
  },
];

export const GLYPH_IDS: readonly GlyphId[] = GLYPHS.map((g) => g.id);

export function findGlyph(id: GlyphId): Glyph {
  return GLYPHS.find((g) => g.id === id) ?? (GLYPHS[0] as Glyph);
}
