// Brand-mark generator behind <ui-logo-mark> and <ui-logo-forge>: a framework-free port of the React kit's
// brand/{rng,initials,palettes,generate}. Shared through internal/ so neither entry imports the other.
import { findGlyph, GLYPH_IDS, type GlyphId } from "./e15-brand-glyphs.js";

/** FNV-1a over UTF-16 code units; stable across runtimes. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32): the same seed always yields the same sequence. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

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

export const MARK_SHAPES = [
  "circle",
  "squircle",
  "shield",
  "hexagon",
  "badge",
  "ribbon",
  "none",
] as const;
export const MARK_LAYOUTS = ["icon", "horizontal", "stacked"] as const;
export const MARK_FILLS = ["solid", "gradient", "outline"] as const;

export type MarkShape = (typeof MARK_SHAPES)[number];
export type MarkLayout = (typeof MARK_LAYOUTS)[number];
export type MarkFill = (typeof MARK_FILLS)[number];
export type MarkMonogram = "initials" | "glyph";

export interface WordmarkStyle {
  weight?: 400 | 500 | 600 | 700 | 800;
  /** Letter spacing in em. */
  tracking?: number;
  uppercase?: boolean;
}

export interface MarkOptions {
  /** Business name: drives the wordmark and the initials. */
  name: string;
  tagline?: string;
  /** Overrides the initials taken from `name`. */
  initials?: string;
  shape?: MarkShape;
  monogram?: MarkMonogram;
  glyph?: GlyphId;
  initialsCount?: 1 | 2 | 3;
  /** A palette id from `BRAND_PALETTES` or a custom palette. */
  palette?: BrandPalette | string;
  layout?: MarkLayout;
  fill?: MarkFill;
  /** 0 is the canonical look; other values deterministically vary angle, tilt, ring and color order. */
  seed?: number;
  /** Inner ring; left undefined it follows the seed. */
  ring?: boolean;
  wordmark?: WordmarkStyle;
  /** Paints a padded background rectangle behind the mark. */
  background?: string;
  /** Overrides the wordmark color (use a light one over a dark background). */
  wordmarkColor?: string;
}

export type MarkTag = "title" | "defs" | "linearGradient" | "stop" | "g" | "path" | "rect" | "text";

export interface MarkNode {
  tag: MarkTag;
  attrs: Record<string, string | number>;
  children?: MarkNode[];
  text?: string;
}

export interface MarkDescription {
  viewBox: string;
  width: number;
  height: number;
  /** Accessible name, also emitted as `<title>`. */
  label: string;
  nodes: MarkNode[];
}

export const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif";

const num = (n: number) => Number(n.toFixed(2));

function badgePath(): string {
  const points: string[] = [];
  for (let i = 0; i < 32; i += 1) {
    const radius = i % 2 === 0 ? 47 : 41.5;
    const angle = (Math.PI * 2 * i) / 32 - Math.PI / 2;
    points.push(`${num(50 + radius * Math.cos(angle))} ${num(50 + radius * Math.sin(angle))}`);
  }
  return `M${points.join("L")}Z`;
}

const SHAPE_PATHS: Record<Exclude<MarkShape, "none">, string> = {
  circle: "M50 4a46 46 0 1 0 0 92a46 46 0 1 0 0-92Z",
  squircle: "M50 4C82 4 96 18 96 50S82 96 50 96 4 82 4 50 18 4 50 4Z",
  shield: "M50 4L90 16V48C90 72 72 88 50 96C28 88 10 72 10 48V16Z",
  hexagon: "M50 4L90 27V73L50 96L10 73V27Z",
  badge: badgePath(),
  ribbon: "M10 6H90V94L50 76L10 94Z",
};

/** Vertical center of the monogram per shape (the shield and ribbon taper below). */
const CONTENT_Y: Record<MarkShape, number> = {
  circle: 50,
  squircle: 50,
  shield: 46,
  hexagon: 50,
  badge: 50,
  ribbon: 42,
  none: 50,
};

function stripInvalidXml(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const control = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (!control && code !== 0xfffe && code !== 0xffff) out += char;
  }
  return out;
}

export function escapeXml(value: string): string {
  return stripInvalidXml(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePalette(palette: MarkOptions["palette"]): BrandPalette {
  const base =
    typeof palette === "object" && palette !== null ? palette : findPalette(palette ?? "coral");
  const fallback = findPalette("coral");
  return {
    id: base.id,
    label: base.label,
    primary: safeColor(base.primary, fallback.primary),
    secondary: safeColor(base.secondary, fallback.secondary),
    ink: safeColor(base.ink, fallback.ink),
  };
}

function gradient(id: string, angle: number, from: string, to: string, extent?: number): MarkNode {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  const scale = extent ?? 1;
  const attrs: Record<string, string | number> = {
    id,
    x1: num((0.5 - dx) * scale),
    y1: num((0.5 - dy) * scale),
    x2: num((0.5 + dx) * scale),
    y2: num((0.5 + dy) * scale),
  };
  if (extent) attrs.gradientUnits = "userSpaceOnUse";
  return {
    tag: "linearGradient",
    attrs,
    children: [
      { tag: "stop", attrs: { offset: 0, "stop-color": from } },
      { tag: "stop", attrs: { offset: 1, "stop-color": to } },
    ],
  };
}

interface Look {
  palette: BrandPalette;
  shape: MarkShape;
  fill: MarkFill;
  angle: number;
  tilt: number;
  ring: boolean;
  from: string;
  to: string;
}

function resolveLook(options: MarkOptions): Look {
  const palette = resolvePalette(options.palette);
  const seed = Math.trunc(options.seed ?? 0);
  const rng = createRng(hashString(`${seed}:${options.name}`));
  const angle = pick(rng, [135, 0, 45, 90, 180, 225, 270, 315]);
  const tilt = pick(rng, [0, -8, -4, 4, 8]);
  const ringRoll = rng();
  const swap = rng() < 0.5;
  const varied = seed !== 0;
  return {
    palette,
    shape: options.shape ?? "circle",
    fill: options.fill ?? "solid",
    angle: varied ? angle : 135,
    tilt: varied ? tilt : 0,
    ring: options.ring ?? (varied && ringRoll < 0.4),
    from: varied && swap ? palette.secondary : palette.primary,
    to: varied && swap ? palette.primary : palette.secondary,
  };
}

function buildIcon(
  options: MarkOptions,
  look: Look,
  gid: string,
): { defs: MarkNode[]; nodes: MarkNode[] } {
  const { palette, shape, fill, from, to } = look;
  const defs: MarkNode[] = [];
  const nodes: MarkNode[] = [];
  const hasShape = shape !== "none";
  const gradientFill = fill === "gradient";
  if (gradientFill) defs.push(gradient(gid, look.angle, from, to));

  const filled = fill !== "outline";
  const content =
    hasShape && filled
      ? contentColor(gradientFill ? [from, to] : [palette.primary], palette.ink)
      : null;

  if (hasShape) {
    const d = SHAPE_PATHS[shape as Exclude<MarkShape, "none">];
    nodes.push(
      filled
        ? { tag: "path", attrs: { d, fill: gradientFill ? `url(#${gid})` : palette.primary } }
        : {
            tag: "path",
            attrs: {
              d,
              fill: "none",
              stroke: palette.primary,
              "stroke-width": 5,
              "stroke-linejoin": "round",
            },
          },
    );
    if (look.ring) {
      nodes.push({
        tag: "path",
        attrs: {
          d,
          transform: "translate(9 9) scale(.82)",
          fill: "none",
          stroke: content ?? palette.primary,
          "stroke-width": 2.4,
          "stroke-opacity": 0.55,
          "stroke-linejoin": "round",
        },
      });
    }
  }

  const cy = CONTENT_Y[shape];
  const monogram = options.monogram ?? "initials";
  const count = options.initialsCount ?? 2;
  const letters = (options.initials ?? getInitials(options.name, count)).slice(0, 3);
  const useGlyph = monogram === "glyph" || letters.length === 0;
  const glyph = findGlyph(
    options.glyph ?? (useGlyph && monogram === "initials" ? "star" : (GLYPH_IDS[0] as GlyphId)),
  );
  const plain = content ?? palette.primary;

  if (useGlyph) {
    const size = hasShape ? 50 : 76;
    const scale = size / 24;
    let paint = plain;
    if (!hasShape && gradientFill) {
      const gradId = `${gid}g`;
      defs.push(gradient(gradId, look.angle, from, to, 24));
      paint = `url(#${gradId})`;
    }
    const parts: MarkNode[] = glyph.parts.map(
      (part): MarkNode =>
        part.kind === "fill"
          ? { tag: "path", attrs: { d: part.d, fill: paint } }
          : {
              tag: "path",
              attrs: {
                d: part.d,
                fill: "none",
                stroke: paint,
                "stroke-width": 2,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
              },
            },
    );
    nodes.push({
      tag: "g",
      attrs: {
        transform: `translate(50 ${cy}) rotate(${look.tilt}) scale(${num(scale)}) translate(-12 -12)`,
      },
      children: parts,
    });
  } else {
    const size = hasShape
      ? ([54, 42, 32] as const)[letters.length - 1]
      : ([80, 62, 46] as const)[letters.length - 1];
    nodes.push({
      tag: "text",
      attrs: {
        x: 50,
        y: cy,
        dy: "0.35em",
        "text-anchor": "middle",
        "font-family": FONT_STACK,
        "font-size": size ?? 42,
        "font-weight": 800,
        "letter-spacing": letters.length > 1 ? "-0.02em" : "0",
        transform: look.tilt ? `rotate(${look.tilt} 50 ${cy})` : undefined,
        fill: !hasShape && gradientFill ? `url(#${gid})` : plain,
      } as Record<string, string | number>,
      text: letters,
    });
  }
  for (const node of nodes) {
    if (node.attrs.transform === undefined) delete node.attrs.transform;
  }
  return { defs, nodes };
}

function textWidth(
  text: string,
  size: number,
  weight: number,
  tracking: number,
  upper: boolean,
): number {
  const factor = 0.56 + ((weight - 400) / 400) * 0.08 + (upper ? 0.1 : 0);
  return text.length * size * (factor + tracking);
}

export function generateMark(options: MarkOptions): MarkDescription {
  const name = (options.name ?? "").trim().slice(0, 60);
  const tagline = (options.tagline ?? "").trim().slice(0, 80);
  const resolved: MarkOptions = { ...options, name };
  const look = resolveLook(resolved);
  const layout = options.layout ?? "icon";
  const gid = `lf${hashString(
    JSON.stringify([
      name,
      look.shape,
      look.fill,
      look.palette,
      look.angle,
      look.tilt,
      look.ring,
      options.glyph,
      options.monogram,
      options.initials,
      options.initialsCount,
    ]),
  ).toString(36)}`;
  const icon = buildIcon(resolved, look, gid);
  const wm = options.wordmark ?? {};
  const weight = wm.weight ?? 700;
  const tracking = Math.max(-0.05, Math.min(0.4, wm.tracking ?? 0.04));
  const upper = wm.uppercase ?? true;
  const shown = upper ? name.toLocaleUpperCase("es") : name;
  const ink = safeColor(options.wordmarkColor, look.palette.ink);
  const pad = options.background ? 14 : 0;

  let width = 100;
  let height = 100;
  const body: MarkNode[] = [];
  const iconGroup: MarkNode = { tag: "g", attrs: {}, children: icon.nodes };

  const hasText = layout !== "icon" && shown.length > 0;
  if (!hasText) {
    body.push(iconGroup);
  } else if (layout === "horizontal") {
    const maxWidth = 280;
    const natural = textWidth(shown, 30, weight, tracking, upper);
    const size = Math.max(14, Math.min(30, (30 * maxWidth) / natural));
    const nameWidth = textWidth(shown, size, weight, tracking, upper);
    const tagSize = Math.max(10, Math.min(13, size * 0.45));
    const tagWidth = textWidth(tagline, tagSize, 500, 0.02, false);
    const x = 100 + 18;
    width = x + Math.max(nameWidth, tagWidth) + 6;
    body.push(iconGroup, {
      tag: "text",
      attrs: {
        x,
        y: tagline ? 46 : 50,
        dy: tagline ? "0" : "0.35em",
        "font-family": FONT_STACK,
        "font-size": num(size),
        "font-weight": weight,
        "letter-spacing": `${tracking}em`,
        fill: ink,
      },
      text: shown,
    });
    if (tagline) {
      body.push({
        tag: "text",
        attrs: {
          x,
          y: 46 + tagSize * 1.7,
          "font-family": FONT_STACK,
          "font-size": num(tagSize),
          "font-weight": 500,
          "letter-spacing": "0.02em",
          fill: ink,
          "fill-opacity": 0.72,
        },
        text: tagline,
      });
    }
  } else {
    const maxWidth = 300;
    const natural = textWidth(shown, 28, weight, tracking, upper);
    const size = Math.max(14, Math.min(28, (28 * maxWidth) / natural));
    const nameWidth = textWidth(shown, size, weight, tracking, upper);
    const tagSize = Math.max(10, Math.min(13, size * 0.46));
    const tagWidth = textWidth(tagline, tagSize, 500, 0.02, false);
    width = Math.max(100, nameWidth, tagWidth) + 8;
    const cx = width / 2;
    const nameY = 100 + 14 + size / 2;
    height = nameY + size / 2 + 4;
    body.push(
      { tag: "g", attrs: { transform: `translate(${num(cx - 50)} 0)` }, children: icon.nodes },
      {
        tag: "text",
        attrs: {
          x: num(cx + (tracking * size) / 2),
          y: num(nameY),
          dy: "0.35em",
          "text-anchor": "middle",
          "font-family": FONT_STACK,
          "font-size": num(size),
          "font-weight": weight,
          "letter-spacing": `${tracking}em`,
          fill: ink,
        },
        text: shown,
      },
    );
    if (tagline) {
      const tagY = nameY + size / 2 + 6 + tagSize / 2;
      height = tagY + tagSize / 2 + 4;
      body.push({
        tag: "text",
        attrs: {
          x: num(cx),
          y: num(tagY),
          dy: "0.35em",
          "text-anchor": "middle",
          "font-family": FONT_STACK,
          "font-size": num(tagSize),
          "font-weight": 500,
          "letter-spacing": "0.02em",
          fill: ink,
          "fill-opacity": 0.72,
        },
        text: tagline,
      });
    }
  }

  width = num(width + pad * 2);
  height = num(height + pad * 2);
  const label = tagline ? `${name} - ${tagline}` : name || "Logo";
  const nodes: MarkNode[] = [{ tag: "title", attrs: {}, text: label }];
  if (icon.defs.length > 0) nodes.push({ tag: "defs", attrs: {}, children: icon.defs });
  if (options.background) {
    nodes.push({
      tag: "rect",
      attrs: { width, height, rx: 10, fill: safeColor(options.background, "#ffffff") },
    });
  }
  nodes.push(
    pad
      ? { tag: "g", attrs: { transform: `translate(${pad} ${pad})` }, children: body }
      : { tag: "g", attrs: {}, children: body },
  );
  return { viewBox: `0 0 ${width} ${height}`, width, height, label, nodes };
}

const TAGS = new Set<string>([
  "title",
  "defs",
  "linearGradient",
  "stop",
  "g",
  "path",
  "rect",
  "text",
]);
const ATTR_NAME = /^[a-zA-Z][a-zA-Z0-9:-]*$/;

function serializeNode(node: MarkNode): string {
  if (!TAGS.has(node.tag)) throw new Error(`Unsupported mark tag: ${node.tag}`);
  const attrs = Object.entries(node.attrs)
    .filter(([key, value]) => value !== undefined && ATTR_NAME.test(key) && !/^on/i.test(key))
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");
  const inner = (node.children ?? []).map(serializeNode).join("") + escapeXml(node.text ?? "");
  return inner ? `<${node.tag}${attrs}>${inner}</${node.tag}>` : `<${node.tag}${attrs}/>`;
}

/** Standalone SVG document string. Every text and attribute value is XML-escaped. */
export function serializeMark(mark: MarkDescription): string {
  const nodes = mark.nodes.map(serializeNode).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeXml(mark.viewBox)}" width="${mark.width}" height="${mark.height}" role="img" aria-label="${escapeXml(mark.label)}">${nodes}</svg>`;
}

const VARIATION_SHAPES = MARK_SHAPES.filter((s) => s !== "none");

/**
 * A deterministic page of `count` variations around `base`: the name, tagline, layout and
 * wordmark stay, while shape, monogram, palette, fill and seed change. `page` shuffles to the
 * next set.
 */
export function generateVariations(base: MarkOptions, count = 12, page = 0): MarkOptions[] {
  const variants: MarkOptions[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = page * count + i + 1;
    const rng = createRng(hashString(`v${seed}:${base.name}`));
    const fillRoll = rng();
    variants.push({
      ...base,
      seed,
      ring: undefined,
      shape: rng() < 0.08 ? "none" : pick(rng, VARIATION_SHAPES),
      monogram: rng() < 0.5 ? "initials" : "glyph",
      glyph: pick(rng, GLYPH_IDS),
      palette: pick(rng, BRAND_PALETTES).id,
      fill: fillRoll < 0.4 ? "solid" : fillRoll < 0.8 ? "gradient" : "outline",
    });
  }
  return variants;
}
