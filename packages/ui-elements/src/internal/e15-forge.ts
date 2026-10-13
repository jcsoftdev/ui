import type {
  BrandPalette,
  MarkFill,
  MarkLayout,
  MarkMonogram,
  MarkOptions,
  MarkShape,
} from "./e15-brand.js";
import type { GlyphId } from "./e15-brand-glyphs.js";

export type ForgeBackground = "none" | "light" | "dark";

/** The editor state of `<ui-logo-forge>` (same shape and defaults as the React kit's `LogoForgeValue`). */
export interface LogoForgeValue {
  name: string;
  tagline: string;
  shape: MarkShape;
  monogram: MarkMonogram;
  glyph: GlyphId;
  initialsCount: 1 | 2 | 3;
  layout: MarkLayout;
  fill: MarkFill;
  /** A palette id or "custom" (uses `custom`). */
  paletteId: string;
  custom: { primary: string; secondary: string; ink: string };
  ring: boolean | undefined;
  seed: number;
  weight: 400 | 600 | 700 | 800;
  tracking: number;
  uppercase: boolean;
  background: ForgeBackground;
}

export const DEFAULT_FORGE_VALUE: LogoForgeValue = {
  name: "Barbería Don Lucho",
  tagline: "Corte y navaja desde 1998",
  shape: "shield",
  monogram: "glyph",
  glyph: "scissors",
  initialsCount: 2,
  layout: "horizontal",
  fill: "solid",
  paletteId: "navaja",
  custom: { primary: "#2f6f5e", secondary: "#e3b04b", ink: "#10211c" },
  ring: false,
  seed: 0,
  weight: 700,
  tracking: 0.06,
  uppercase: true,
  background: "none",
};

/** Turns the editor state into generator options. */
export function forgeOptions(value: LogoForgeValue): MarkOptions {
  const palette: BrandPalette | string =
    value.paletteId === "custom"
      ? { id: "custom", label: "Custom", ...value.custom }
      : value.paletteId;
  return {
    name: value.name,
    tagline: value.tagline,
    shape: value.shape,
    monogram: value.monogram,
    glyph: value.glyph,
    initialsCount: value.initialsCount,
    layout: value.layout,
    fill: value.fill,
    palette,
    seed: value.seed,
    ring: value.ring,
    wordmark: { weight: value.weight, tracking: value.tracking, uppercase: value.uppercase },
    background:
      value.background === "light"
        ? "#ffffff"
        : value.background === "dark"
          ? "#16161b"
          : undefined,
    wordmarkColor: value.background === "dark" ? "#f4f4f6" : undefined,
  };
}
