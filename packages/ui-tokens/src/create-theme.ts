import {
  contrastRatio,
  formatHex,
  hexToOklch,
  type Oklch,
  oklchToHex,
  parseHex,
  solveTone,
} from "./color.ts";
import type { Scheme, Theme, ThemeSeeds, ThemeToken } from "./types.ts";

type Palette = Record<string, string>;

const PAGE = ["bg", "surface"] as const;
const SURFACES = ["bg", "surface", "surface-2", "sunken", "float"] as const;
// The documented guarantee is WCAG AA (4.5 text, 3 non-text). The solver aims slightly above it so
// rounding to 8-bit hex and tooling that computes ratios differently never lands below the line.
const AA_TEXT = 4.55;
const AA_UI = 3.05;

const CHART_CATEGORIES: readonly [hue: number, chroma: number][] = [
  [245, 0.12],
  [165, 0.12],
  [75, 0.13],
  [290, 0.14],
  [340, 0.14],
  [255, 0.03],
  [125, 0.13],
];

const STATUS: Record<"warning" | "info" | "success", [hue: number, chroma: number]> = {
  warning: [85, 0.15],
  info: [255, 0.16],
  success: [150, 0.15],
};

const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${alpha})`;

function normalizeSeeds(seeds: ThemeSeeds) {
  if (!seeds || typeof seeds !== "object")
    throw new TypeError("createTheme expects a seeds object");
  if (seeds.contrast !== undefined && seeds.contrast !== "AA") {
    throw new RangeError(
      `Unsupported contrast "${String(seeds.contrast)}": only "AA" exists in v1`,
    );
  }
  const brandHex = formatHex(parseHex(seeds.brand));
  const brand = hexToOklch(brandHex);
  const neutralSeed = seeds.neutral ? hexToOklch(seeds.neutral) : undefined;
  const dangerSeed = seeds.danger ? hexToOklch(seeds.danger) : undefined;
  const neutral: Oklch = neutralSeed
    ? { l: 0, c: Math.min(neutralSeed.c, 0.04), h: neutralSeed.h }
    : { l: 0, c: Math.min(0.012, brand.c * 0.12), h: brand.h };
  const accent2 = seeds.accent
    ? formatHex(parseHex(seeds.accent))
    : oklchToHex({ ...brand, h: brand.h + 38 });
  const danger: Oklch = dangerSeed ?? { l: 0, c: 0.19, h: 27 };
  return { brandHex, brand, neutral, accent2, danger };
}

function palette(scheme: Scheme, seeds: ReturnType<typeof normalizeSeeds>): Palette {
  const { brandHex, brand, neutral, accent2, danger } = seeds;
  const light = scheme === "light";
  const dir = light ? -1 : 1;
  const grey = (l: number) => oklchToHex({ l, c: neutral.c, h: neutral.h });
  const p: Palette = {};
  const get = (...names: string[]) => names.map((n) => p[n] as string);

  Object.assign(
    p,
    light
      ? {
          bg: grey(0.965),
          surface: "#ffffff",
          "surface-2": grey(0.955),
          sunken: grey(0.925),
          float: "#ffffff",
          line: grey(0.925),
          "line-strong": grey(0.875),
          track: grey(0.91),
          "seg-track": grey(0.93),
          "seg-on": "#ffffff",
          hatch: grey(0.935),
        }
      : {
          bg: "#000000",
          surface: grey(0.18),
          "surface-2": grey(0.235),
          sunken: grey(0.27),
          float: grey(0.205),
          line: grey(0.245),
          "line-strong": grey(0.33),
          track: grey(0.27),
          "seg-track": grey(0.2),
          "seg-on": grey(0.3),
          hatch: grey(0.22),
        },
  );

  p.hair = light ? rgba("0,0,0", 0.11) : rgba("255,255,255", 0.1);
  p.ink = light ? "#000000" : grey(0.96);
  const surfaces = get(...SURFACES);
  const tint = { hue: neutral.h, chroma: neutral.c };
  p["ink-2"] = solveTone({
    ...tint,
    from: light ? 0.45 : 0.8,
    direction: dir,
    against: surfaces,
    min: AA_TEXT,
  });
  p["ink-3"] = solveTone({
    ...tint,
    from: light ? 0.53 : 0.68,
    direction: dir,
    against: surfaces,
    min: AA_TEXT,
  });
  p["line-control"] = solveTone({
    ...tint,
    from: light ? 0.68 : 0.5,
    direction: dir,
    against: get(...PAGE, "surface-2", "float"),
    min: AA_UI,
  });

  // Brand family. The fill is the seed itself in both schemes; text on it flips between a deep and a pale tone.
  p.accent = brandHex;
  const deep = solveTone({
    hue: brand.h,
    chroma: brand.c * 0.4,
    from: 0.28,
    direction: -1,
    against: [brandHex],
    min: AA_TEXT,
  });
  const pale = solveTone({
    hue: brand.h,
    chroma: brand.c * 0.15,
    from: 0.97,
    direction: 1,
    against: [brandHex],
    min: AA_TEXT,
  });
  p["on-accent"] = contrastRatio(deep, brandHex) >= AA_TEXT ? deep : pale;
  p["accent-soft"] = oklchToHex({
    l: light ? 0.96 : 0.2,
    c: Math.min(brand.c * (light ? 0.22 : 0.3), 0.05),
    h: brand.h,
  });
  p["accent-line"] = oklchToHex({ l: light ? 0.86 : 0.32, c: brand.c * 0.35, h: brand.h });
  p["accent-ink"] = solveTone({
    hue: brand.h,
    chroma: brand.c,
    from: light ? Math.min(brand.l, 0.55) : Math.max(brand.l, 0.8),
    direction: dir,
    against: [...get(...PAGE, "surface-2"), p["accent-soft"] as string],
    min: AA_TEXT,
  });
  p["accent-word"] = solveTone({
    hue: brand.h,
    chroma: brand.c,
    from: brand.l,
    direction: dir,
    against: get(...PAGE, "float"),
    min: AA_UI,
  });
  p["accent-2"] = accent2;

  const status = (name: string, hue: number, chroma: number) => {
    p[`${name}-soft`] = oklchToHex({
      l: light ? 0.955 : 0.19,
      c: Math.min(chroma * (light ? 0.25 : 0.33), 0.05),
      h: hue,
    });
    p[name] = solveTone({
      hue,
      chroma,
      from: light ? 0.5 : 0.8,
      direction: dir,
      against: [...get(...PAGE), p[`${name}-soft`] as string],
      min: AA_TEXT,
    });
  };
  status("danger", danger.h, danger.c);
  for (const [name, [hue, chroma]] of Object.entries(STATUS)) status(name, hue, chroma);

  p.scrim = light ? rgba("0,0,0", 0.2) : rgba("0,0,0", 0.72);
  p["toast-bg"] = light ? "#000000" : grey(0.24);
  p["toast-ink"] = solveTone({
    ...tint,
    from: 0.97,
    direction: 1,
    against: [p["toast-bg"] as string],
    min: AA_TEXT,
  });

  CHART_CATEGORIES.forEach(([hue, chroma], i) => {
    p[`chart-cat-${i + 1}`] = solveTone({
      hue,
      chroma,
      from: light ? 0.6 : 0.78,
      direction: dir,
      against: get(...PAGE),
      min: AA_UI,
    });
  });
  p["chart-cat-reserve"] = p["accent-word"] as string;
  p["chart-grid"] = light ? rgba("0,0,0", 0.06) : rgba("255,255,255", 0.07);
  p["chart-crosshair"] = light ? rgba("0,0,0", 0.3) : rgba("255,255,255", 0.34);
  const chart = (name: string, hue: number, chroma: number, from: number) => {
    p[name] = solveTone({
      hue,
      chroma,
      from: light ? from : 1 - from * 0.55,
      direction: dir,
      against: get(...PAGE),
      min: AA_UI,
    });
  };
  chart("chart-up", 155, 0.15, 0.6);
  chart("chart-down", danger.h, Math.min(danger.c, 0.17), 0.6);
  chart("chart-total", neutral.h, 0.02, 0.4);
  return p;
}

const USAGE: readonly [string, string][] = [
  ["bg", "Page background."],
  ["surface", "Cards, sidebar, fields and rows."],
  ["surface-2", "Hovered row, neutral chip and control fill inside a card."],
  ["sunken", "Sunken areas: neutral avatar and drop zones."],
  ["float", "Things that float above the page: dialogs, sheets and menus."],
  ["line", "Decorative dividers and borders."],
  ["line-strong", "Stronger decorative border."],
  [
    "line-control",
    "Border of text fields, selects and checkboxes (3:1 on bg, surface, surface-2 and float).",
  ],
  ["hair", "Hairline around cards and secondary buttons."],
  ["track", "Progress bar track."],
  ["seg-track", "Segmented control tray."],
  ["seg-on", "Selected segmented option."],
  ["ink", "Primary text."],
  ["ink-2", "Secondary text (4.5:1 on every surface)."],
  ["ink-3", "Metadata text (4.5:1 on every surface)."],
  ["accent", "Brand fill: the primary action and the selected state."],
  ["on-accent", "Text and icons on an accent fill (4.5:1)."],
  [
    "accent-ink",
    "Brand-colored text and focus ring (4.5:1 on bg, surface, surface-2 and accent-soft).",
  ],
  ["accent-word", "Brand-colored large text and the on switch (3:1 on bg, surface and float)."],
  ["accent-soft", "Soft brand background."],
  ["accent-line", "Brand hairline."],
  ["accent-2", "Neighbour tone for gradients and illustrations."],
  ["danger", "Error text and icons (4.5:1 on surface and danger-soft)."],
  ["danger-soft", "Error background."],
  ["warning", "Warning text and icons (4.5:1 on surface and warning-soft)."],
  ["warning-soft", "Warning background."],
  ["info", "Informational text and icons (4.5:1 on surface and info-soft)."],
  ["info-soft", "Informational background."],
  ["success", "Success text and icons (4.5:1 on surface and success-soft)."],
  ["success-soft", "Success background."],
  ["hatch", "Diagonal hatch for unavailable time."],
  ["scrim", "Veil behind dialogs and sheets."],
  ["toast-bg", "Toast background."],
  ["toast-ink", "Toast text (4.5:1 on toast-bg)."],
  ...CHART_CATEGORIES.map((_, i): [string, string] => [
    `chart-cat-${i + 1}`,
    `Charts: categorical series ${i + 2} (3:1 on bg and surface).`,
  ]),
  ["chart-cat-reserve", "Charts: reserve category color, equal to accent-word."],
  ["chart-grid", "Charts: background guide lines."],
  ["chart-crosshair", "Charts: pointer crosshair."],
  ["chart-up", "Charts: rising value (3:1)."],
  ["chart-down", "Charts: falling value (3:1)."],
  ["chart-total", "Charts: totals and unchanged values (3:1)."],
];

/**
 * Derives every semantic color token, for light and dark, from a few seed colors.
 * Pure and deterministic. Every pair in `CONTRAST_PAIRS` meets WCAG 2 AA in both schemes.
 */
export function createTheme(seeds: ThemeSeeds): Theme {
  const normalized = normalizeSeeds(seeds);
  const light = palette("light", normalized);
  const dark = palette("dark", normalized);
  const tokens: ThemeToken[] = USAGE.map(([name, usage]) => ({
    name,
    value: { light: light[name] as string, dark: dark[name] as string },
    usage,
  }));
  return {
    name: seeds.name ?? `Generated ${normalized.brandHex}`,
    version: 2,
    color: {
      themes: [
        { id: "light", name: "Light" },
        { id: "dark", name: "Dark" },
      ],
      tokens,
    },
  };
}
