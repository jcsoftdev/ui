/** Gauge layout: the largest arc that fits the box, with the value block placed clear of the needle. */
export type GaugeVariant = "semi" | "three-quarter";
export type GaugeMode = "progress" | "needle";

const PAD = 12;
const HUB_RADIUS = 8;
const MIN_RADIUS = 40;
const CAPTION_SIZE = 12;
/** Height of a custom centre block (`centerContent`), which cannot be measured here. */
const CUSTOM_BLOCK_HEIGHT = 72;
const SIN_45 = Math.sin(Math.PI / 4);

export interface GaugeLayoutInput {
  width: number;
  height: number;
  variant: GaugeVariant;
  mode: GaugeMode;
  thickness: number;
  /** Min and max printed under the arc ends. */
  endLabels: boolean;
  /** The value block is custom HTML of unknown size. */
  customCenter: boolean;
  caption: boolean;
  bandLabel: boolean;
  /** Longest formatted value, in characters; sizes the value block width. */
  valueChars: number;
}

export interface GaugeLayout {
  radius: number;
  /** Stroke width of the track and value arc. */
  band: number;
  cx: number;
  cy: number;
  /** Radius of the arc centre line. */
  mid: number;
  valueSize: number;
  /** Distance from the centre to the top of the value block. */
  blockTop: number;
  /** Baselines relative to the centre. */
  valueDy: number;
  captionDy: number;
  labelDy: number;
  /** Where the custom centre block is anchored, relative to the centre. */
  customAnchor: "above" | "below" | "middle";
  customDy: number;
  customWidth: number;
  /** Needle reach from the hub; stops at the arc. */
  needleLength: number;
}

/** Min/max labels duplicate the tick labels at the arc ends, so ticks win. */
export function showEndLabels(minMaxLabels: boolean, ticks: number): boolean {
  return minMaxLabels && !(ticks >= 1);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Width of one tabular glyph as a share of the font size. */
const GLYPH_WIDTH = 0.6;

/**
 * Value font size: scales with the radius, but long values (currency) shrink
 * so the text stays inside the inner edge of the arc.
 */
function valueSizeFor(input: GaugeLayoutInput, radius: number, band: number): number {
  const bySize = clamp(radius * 0.34, 20, 52);
  if (input.customCenter || input.valueChars <= 0) return Math.round(bySize);
  const inner = input.mode === "needle" ? radius * 2 : (radius - band) * 2 - 16;
  const byWidth = inner / (input.valueChars * GLYPH_WIDTH);
  return Math.max(12, Math.min(Math.round(bySize), Math.floor(byWidth)));
}

interface Block {
  /** Distance from the centre to the top of the block. */
  top: number;
  valueDy: number;
  captionDy: number;
  labelDy: number;
  bottom: number;
}

function blockFor(input: GaugeLayoutInput, radius: number, valueSize: number): Block {
  const { variant, mode, customCenter } = input;
  const halfWidth = customCenter ? radius * 0.35 : (input.valueChars * GLYPH_WIDTH * valueSize) / 2;
  const needle = mode === "needle";
  let top: number;
  if (needle) {
    // Semicircle: the sweep is the upper half, anything under the hub is free.
    // Three-quarter: the free area is the wedge under the hub, so the top
    // corners of the block must sit below the 45 degree needle positions.
    top = variant === "semi" ? HUB_RADIUS + 14 : Math.max(HUB_RADIUS + 14, halfWidth + 12);
  } else if (variant === "semi") {
    top = customCenter ? -(CUSTOM_BLOCK_HEIGHT + 6) : -(valueSize * 0.9 + 6);
  } else {
    top = customCenter ? -CUSTOM_BLOCK_HEIGHT / 2 : -valueSize * 0.5;
  }
  const gap = needle ? 6 : 8;
  const valueDy = top + valueSize * 0.85;
  const captionDy = valueDy + gap + CAPTION_SIZE;
  const withCaption = input.caption ? captionDy : valueDy;
  const labelDy = withCaption + (input.caption || !needle ? 16 : 14);
  const last = input.bandLabel ? labelDy : withCaption;
  const bottom = customCenter ? top + CUSTOM_BLOCK_HEIGHT : last + 4;
  return { top, valueDy, captionDy, labelDy, bottom };
}

/** Distance from the centre to the lowest thing drawn. */
function below(input: GaugeLayoutInput, radius: number, band: number): number {
  const valueSize = valueSizeFor(input, radius, band);
  const mid = radius - band / 2;
  const arcBottom = input.variant === "semi" ? band / 2 : mid * SIN_45 + band / 2;
  const withLabels = arcBottom + (input.endLabels ? 19 : 2);
  const block = blockFor(input, radius, valueSize).bottom;
  const needleHub = input.mode === "needle" ? HUB_RADIUS : 0;
  return Math.max(withLabels, block, needleHub);
}

/**
 * Largest arc that fits the box in both directions, with the value block
 * placed where the needle and hub never reach it.
 */
export function layoutGauge(input: GaugeLayoutInput): GaugeLayout {
  const { width, height, thickness } = input;
  const maxByWidth = width / 2 - PAD - (input.endLabels ? 6 : 0);
  const fits = (radius: number) => {
    const band = Math.min(thickness, radius * 0.4);
    return radius + below(input, radius, band) + PAD * 2 <= height;
  };

  let radius = MIN_RADIUS;
  if (maxByWidth > MIN_RADIUS) {
    if (fits(maxByWidth)) {
      radius = maxByWidth;
    } else {
      let lo = MIN_RADIUS;
      let hi = maxByWidth;
      for (let i = 0; i < 30; i++) {
        const probe = (lo + hi) / 2;
        if (fits(probe)) lo = probe;
        else hi = probe;
      }
      radius = lo;
    }
  }

  const band = Math.min(thickness, radius * 0.4);
  const mid = radius - band / 2;
  const valueSize = valueSizeFor(input, radius, band);
  const block = blockFor(input, radius, valueSize);
  const extent = radius + below(input, radius, band);
  const cx = width / 2;
  const cy = Math.max(PAD + radius, (height - extent) / 2 + radius);

  const needle = input.mode === "needle";
  const customAnchor = needle || input.variant === "three-quarter" ? "below" : "above";
  const customWidth = Math.max(40, radius * 1.5);
  let customDy = block.top;
  let anchor: GaugeLayout["customAnchor"] = customAnchor;
  if (!needle && input.variant === "semi") customDy = -6;
  else if (!needle) {
    anchor = "middle";
    customDy = 0;
  }

  return {
    radius,
    band,
    cx,
    cy,
    mid,
    valueSize,
    blockTop: block.top,
    valueDy: block.valueDy,
    captionDy: block.captionDy,
    labelDy: block.labelDy,
    customAnchor: anchor,
    customDy,
    customWidth,
    needleLength: mid + band * 0.3,
  };
}
