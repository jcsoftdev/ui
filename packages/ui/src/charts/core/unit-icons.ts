/**
 * Built-in silhouettes for unit charts, drawn on a 24 x 24 grid as solid
 * shapes (so a partial unit can be clipped). Any SVG path can be used instead:
 * pass the `d` string (24 x 24 box assumed) or a `UnitShape` with its own box.
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

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const commands: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.round((cx + radius * Math.cos(angle)) * 100) / 100;
    const y = Math.round((cy + radius * Math.sin(angle)) * 100) / 100;
    commands.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return `${commands.join("")}Z`;
}

const PERSON =
  "M12 2.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4.5 21.5v-2.8c0-3.6 3.3-6.2 7.5-6.2s7.5 2.6 7.5 6.2v2.8z";

export const UNIT_ICONS = {
  person: { path: PERSON, labelY: 17.5 },
  scissors: {
    // Rings wind the other way round, so they stay hollow with the nonzero rule.
    path: [
      "M3 17.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0zM4.9 17.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z",
      "M14 17.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0zM15.9 17.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z",
      "M8.6 14.6L17.6 2.2L19 3.4L10.5 15.7z",
      "M13.5 15.7L5 3.4L6.4 2.2L15.4 14.6z",
    ].join(""),
  },
  chair: {
    path: [
      "M7.5 2.5h9a1.5 1.5 0 0 1 1.5 1.5v6.5H6V4a1.5 1.5 0 0 1 1.5-1.5z",
      "M3.5 11h17a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1z",
      "M5.5 14.5h13v2.5h-13z",
      "M11 17h2v3h-2z",
      "M6.5 20h11a1 1 0 0 1 1 1v.5h-13V21a1 1 0 0 1 1-1z",
    ].join(""),
  },
  star: { path: starPath(12, 12.6, 10.5, 4.4) },
  calendar: {
    fillRule: "evenodd",
    path: [
      "M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
      "M7 2h2.2v3H7zM14.8 2H17v3h-2.2z",
      "M6.5 10.5h3v3h-3zM10.5 10.5h3v3h-3zM14.5 10.5h3v3h-3zM6.5 15.5h3v3h-3zM10.5 15.5h3v3h-3z",
    ].join(""),
  },
  bottle: {
    labelY: 14.5,
    path: [
      "M9.5 1.5h5v3.5h-5z",
      "M10.2 5h3.6v2.2c2.6.9 4.2 2.9 4.2 5.6v7.7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7.7c0-2.7 1.6-4.7 4.2-5.6z",
    ].join(""),
  },
  battery: {
    path: "M2.5 7.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2zM20.5 9.5h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1z",
    fill: "right",
  },
  droplet: {
    path: "M12 1.8c3.9 4.8 7.5 9 7.5 13a7.5 7.5 0 0 1-15 0c0-4 3.6-8.2 7.5-13z",
  },
  target: {
    path: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z",
    detail: "M5.5 12a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z",
  },
  shield: {
    path: "M12 1.8l8.5 3.2v6.4c0 5.4-3.6 9.5-8.5 11.1c-4.9-1.6-8.5-5.7-8.5-11.1V5z",
  },
} as const satisfies Record<string, UnitShape>;

export type UnitIconName = keyof typeof UNIT_ICONS;

/** A built-in name, a raw path (24 x 24 box) or a full shape definition. */
export type UnitIcon = UnitIconName | UnitShape | (string & {});

export function isUnitIconName(value: unknown): value is UnitIconName {
  return typeof value === "string" && Object.hasOwn(UNIT_ICONS, value);
}

export function resolveUnitShape(icon: UnitIcon): ResolvedUnitShape {
  const shape: UnitShape = isUnitIconName(icon)
    ? UNIT_ICONS[icon]
    : typeof icon === "string"
      ? { path: icon }
      : icon;
  return {
    path: shape.path,
    width: shape.width ?? 24,
    height: shape.height ?? 24,
    fillRule: shape.fillRule ?? "nonzero",
    detail: shape.detail,
    fill: shape.fill ?? "up",
    labelY: shape.labelY ?? (shape.height ?? 24) / 2,
  };
}

/** A category of a unit chart: one color, optionally its own icon. */
export interface UnitCategory {
  id: string;
  name: string;
  value: number;
  /** CSS color; the palette slot of the category by default. */
  color?: string;
  /** Icon of this category; the chart `icon` by default. */
  icon?: UnitIcon;
}
