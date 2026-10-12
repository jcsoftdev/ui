import { contrastRatio } from "./color.ts";
import type { Scheme, Theme } from "./types.ts";

export interface ContrastPair {
  fg: string;
  bg: string;
  /** 4.5 for text, 3 for UI components and graphical objects (WCAG 2.1 1.4.3 and 1.4.11). */
  min: 4.5 | 3;
  kind: "text" | "ui";
}

const text = (fg: string, bgs: string[]): ContrastPair[] =>
  bgs.map((bg) => ({ fg, bg, min: 4.5, kind: "text" }));
const ui = (fg: string, bgs: string[]): ContrastPair[] =>
  bgs.map((bg) => ({ fg, bg, min: 3, kind: "ui" }));

const PAGE = ["bg", "surface"];
const SURFACES = ["bg", "surface", "surface-2", "sunken", "float"];
const STATUS = ["danger", "warning", "info", "success"];

/** Every foreground/background pair createTheme guarantees, in both color schemes. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...text("ink", SURFACES),
  ...text("ink-2", SURFACES),
  ...text("ink-3", SURFACES),
  ...text("on-accent", ["accent"]),
  ...text("accent-ink", [...PAGE, "surface-2", "accent-soft"]),
  ...text("toast-ink", ["toast-bg"]),
  ...STATUS.flatMap((s) => text(s, [...PAGE, `${s}-soft`])),
  ...ui("line-control", [...PAGE, "surface-2", "float"]),
  ...ui("accent-word", [...PAGE, "float"]),
  ...["1", "2", "3", "4", "5", "6", "7"].flatMap((n) => ui(`chart-cat-${n}`, PAGE)),
  ...["reserve"].flatMap((n) => ui(`chart-cat-${n}`, PAGE)),
  ...["up", "down", "total"].flatMap((n) => ui(`chart-${n}`, PAGE)),
];

export interface ContrastViolation extends ContrastPair {
  scheme: Scheme;
  ratio: number;
}

const HEX_ONLY = /^#[0-9a-f]{6}$/i;

/** Lists every declared pair that is missing or below its minimum ratio. Empty means compliant. */
export function auditTheme(theme: Theme, pairs: readonly ContrastPair[] = CONTRAST_PAIRS) {
  const byName = new Map(theme.color.tokens.map((t) => [t.name, t.value]));
  const violations: ContrastViolation[] = [];
  for (const scheme of ["light", "dark"] as const) {
    for (const pair of pairs) {
      const fg = byName.get(pair.fg)?.[scheme];
      const bg = byName.get(pair.bg)?.[scheme];
      const ratio = fg && bg && HEX_ONLY.test(fg) && HEX_ONLY.test(bg) ? contrastRatio(fg, bg) : 0;
      if (ratio < pair.min) violations.push({ ...pair, scheme, ratio });
    }
  }
  return violations;
}
