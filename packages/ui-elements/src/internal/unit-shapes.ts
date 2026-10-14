/**
 * Silhouettes for unit charts, drawn on a 24 x 24 grid as solid shapes (so a partial unit can be
 * clipped). Only the default icon of each chart (person, scissors, star) is here; the other built-in
 * names load from `unit-shape-catalogue` the first time one is used. Any SVG path works too: pass the
 * `d` string (24 x 24 box assumed) or a `UnitShape` with its own box.
 */

export interface UnitShape {
  /** SVG path data. */
  path: string;
  /** Size of the drawing box; 24 x 24 by default. */
  width?: number;
  height?: number;
  fillRule?: "nonzero" | "evenodd";
  /** Optional stroked detail drawn over the shape (e.g. the rings of a target). */
  detail?: string;
  /** Direction a fill-gauge liquid rises: "up" (default) or "right" (a battery). */
  fill?: "up" | "right";
  /** Vertical position of a fill-gauge label in shape units; the middle by default. */
  labelY?: number;
}

export interface ResolvedUnitShape {
  path: string;
  width: number;
  height: number;
  fillRule: "nonzero" | "evenodd";
  detail?: string;
  fill: "up" | "right";
  labelY: number;
}

const DEFAULTS: Record<string, UnitShape> = {
  person: {
    path: "M12 2.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4.5 21.5v-2.8c0-3.6 3.3-6.2 7.5-6.2s7.5 2.6 7.5 6.2v2.8z",
    labelY: 17.5,
  },
  scissors: {
    // Rings wind the other way round, so they stay hollow with the nonzero rule.
    path: [
      "M3 17.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0zM4.9 17.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z",
      "M14 17.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0zM15.9 17.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z",
      "M8.6 14.6L17.6 2.2L19 3.4L10.5 15.7z",
      "M13.5 15.7L5 3.4L6.4 2.2L15.4 14.6z",
    ].join(""),
  },
  star: {
    path: "M12 2.1L14.59 9.04L21.99 9.36L16.18 13.96L18.17 21.09L12 17L5.83 21.09L7.82 13.96L2.01 9.36L9.41 9.04Z",
  },
};

/** Human figures and everyday silhouettes for pictograms, in gallery order. */
export const PICTOGRAM_SILHOUETTES = [
  "person",
  "woman",
  "child",
  "heart",
  "tree",
  "house",
  "car",
  "star",
  "drop",
  "clock",
  "pin",
] as const;

/** Barbershop silhouettes drawn for this library. */
export const BARBER_SILHOUETTES = [
  "scissors",
  "comb",
  "mustache",
  "pole",
  "chair",
  "bottle",
] as const;

/** A built-in name, a raw path (24 x 24 box) or a full shape definition. */
export type UnitIcon = string | UnitShape;

let catalogue: Record<string, UnitShape> | undefined;
let loading: Promise<void> | undefined;

/** Fetches the other built-in silhouettes once, then calls every waiting chart back. */
function load(onLoad: () => void): void {
  loading ??= import("./unit-shape-catalogue.js").then((module) => {
    catalogue = module.UNIT_ICONS;
  });
  loading.then(onLoad);
}

const isName = (icon: string) => /^[a-z][a-z-]*$/.test(icon);

/**
 * The shape of `icon`. A built-in name outside the defaults draws the person until its code has
 * loaded, then `onLoad` redraws the chart. Only `nonzero` and `evenodd` pass as a fill rule.
 */
export function resolveUnitShape(icon: UnitIcon, onLoad?: () => void): ResolvedUnitShape {
  let shape: UnitShape | undefined;
  if (typeof icon !== "string") shape = icon;
  else if (!isName(icon)) shape = { path: icon };
  else {
    shape = Object.hasOwn(DEFAULTS, icon) ? DEFAULTS[icon] : catalogue?.[icon];
    if (!shape && !catalogue && onLoad) load(onLoad);
  }
  const used = shape ?? (DEFAULTS.person as UnitShape);
  return {
    path: used.path,
    width: used.width ?? 24,
    height: used.height ?? 24,
    fillRule: used.fillRule === "evenodd" ? "evenodd" : "nonzero",
    detail: used.detail,
    fill: used.fill === "right" ? "right" : "up",
    labelY: used.labelY ?? (used.height ?? 24) / 2,
  };
}
