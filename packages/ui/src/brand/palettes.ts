export interface BrandPalette {
  id: string;
  label: string;
  /** Main fill of the shape. */
  primary: string;
  /** Second stop of gradients and decorations. */
  secondary: string;
  /** Wordmark color on a light background and glyph color over pale fills. */
  ink: string;
}

/**
 * The first seven mirror the library accent palettes (fill, second tone and deep ink);
 * the rest are classic barbershop colorways. Marks keep their own colors, they never
 * follow the surrounding `data-accent`.
 */
export const BRAND_PALETTES: readonly BrandPalette[] = [
  { id: "coral", label: "Coral", primary: "#faa2a2", secondary: "#fec79e", ink: "#3f191a" },
  { id: "durazno", label: "Durazno", primary: "#efae75", secondary: "#e1d695", ink: "#3b1f02" },
  { id: "menta", label: "Menta", primary: "#77d3ad", secondary: "#8ee5ed", ink: "#002f1f" },
  { id: "cielo", label: "Cielo", primary: "#76c9f8", secondary: "#c6d2ff", ink: "#002a3e" },
  { id: "lavanda", label: "Lavanda", primary: "#bab3fe", secondary: "#f2c1f3", ink: "#252142" },
  { id: "orquidea", label: "Orquídea", primary: "#eaa3d5", secondary: "#fec2c5", ink: "#391a31" },
  { id: "grafito", label: "Grafito", primary: "#26262b", secondary: "#5a5a66", ink: "#1a1a1e" },
  { id: "navaja", label: "Navaja", primary: "#1f2f57", secondary: "#c8372d", ink: "#14203d" },
  { id: "bronce", label: "Bronce", primary: "#8a5a2b", secondary: "#d9a441", ink: "#2c1b0a" },
  { id: "esmeralda", label: "Esmeralda", primary: "#14614a", secondary: "#9bd17f", ink: "#0a2e23" },
  { id: "vino", label: "Vino", primary: "#6e1f3a", secondary: "#e08a6a", ink: "#2f0d19" },
];

export function findPalette(id: string): BrandPalette {
  return BRAND_PALETTES.find((p) => p.id === id) ?? (BRAND_PALETTES[0] as BrandPalette);
}

const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9a-z.,%\s/-]{1,48}\)|[a-z]{3,20})$/i;

/** Accepts hex, rgb()/hsl() and plain color names only; anything else falls back. */
export function safeColor(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return COLOR.test(trimmed) ? trimmed : fallback;
}

function channels(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})/i.exec(color)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** WCAG relative luminance of a hex color; other formats read as mid-dark. */
export function luminance(color: string): number {
  const rgb = channels(color);
  if (!rgb) return 0.2;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The palette ink over pale fills, white over dark ones. */
export function contentColor(fills: string[], ink: string): string {
  const avg = fills.reduce((sum, c) => sum + luminance(c), 0) / fills.length;
  return avg > 0.38 ? ink : "#ffffff";
}
