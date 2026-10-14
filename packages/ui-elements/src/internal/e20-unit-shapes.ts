/** Built-in silhouettes for the fill gauge (the React kit's unit icons), on a 24 x 24 grid. Never an element entry. */
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
  woman: {
    path: "M12 0.9a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8zM9 9h6l4.5 10h-15zM9.8 19h1.9v4h-1.9zM12.3 19h1.9v4h-1.9z",
    labelY: 15,
  },
  child: {
    path: "M12 5.4a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4zM6.8 21.5v-2.2c0-2.9 2.3-5 5.2-5s5.2 2.1 5.2 5v2.2z",
    labelY: 18,
  },
  heart: {
    path: "M12 21.2C5.6 16.1 2.5 12.6 2.5 8.6A5 5 0 0 1 12 6.4a5 5 0 0 1 9.5 2.2c0 4-3.1 7.5-9.5 12.6z",
    labelY: 11.5,
  },
  tree: {
    path: "M12 1.8L18 9.5H15.2L19.5 15.5H4.5L8.8 9.5H6zM10.8 15.5h2.4V22h-2.4z",
    labelY: 11,
  },
  house: {
    path: "M12 2.2L21.5 10.6H18.9V21H13.7V15H10.3V21H5.1V10.6H2.5z",
    labelY: 12,
  },
  car: {
    fillRule: "evenodd",
    path: [
      "M3.2 12.5l1.7-4.6A2.5 2.5 0 0 1 7.2 6.3h9.6a2.5 2.5 0 0 1 2.3 1.6l1.7 4.6c.9.3 1.5 1.1 1.5 2.1v3.2a1 1 0 0 1-1 1h-1.2a2.8 2.8 0 0 1-5.6 0H9.4a2.8 2.8 0 0 1-5.6 0H2.7a1 1 0 0 1-1-1v-3.2c0-1 .6-1.8 1.5-2.1z",
      "M7 8h4.2v3.3H5.9zM12.8 8H17l1.1 3.3h-5.3z",
    ].join(""),
  },
  drop: {
    path: "M12 1.8c3.9 4.8 7.5 9 7.5 13a7.5 7.5 0 0 1-15 0c0-4 3.6-8.2 7.5-13z",
  },
  clock: {
    fillRule: "evenodd",
    path: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM11 6h2v6.3l4 2.3-1 1.7-5-3z",
  },
  pin: {
    fillRule: "evenodd",
    path: "M12 1.8a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 12.9 7.5 12.9s7.5-7.5 7.5-12.9A7.5 7.5 0 0 0 12 1.8zM12 6.7a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z",
    labelY: 9.3,
  },
  mustache: {
    path: "M12 9.2C10.6 7.4 8.6 6.4 6.4 6.4C3.8 6.4 1.9 8 1.5 10.6C3.2 9.6 4.9 9.6 6.4 10.7C8.1 12 9.9 13.4 12 13.4C14.1 13.4 15.9 12 17.6 10.7C19.1 9.6 20.8 9.6 22.5 10.6C22.1 8 20.2 6.4 17.6 6.4C15.4 6.4 13.4 7.4 12 9.2Z",
    labelY: 10,
  },
  comb: {
    path: "M3 4h18a1 1 0 0 1 1 1v4H2V5a1 1 0 0 1 1-1zM3 10h1.6v10H3zM6.2 10h1.6v10H6.2zM9.4 10h1.6v10H9.4zM12.6 10h1.6v10h-1.6zM15.8 10h1.6v10h-1.6zM19 10h1.6v10H19z",
    labelY: 7,
  },
  pole: {
    fillRule: "evenodd",
    path: "M8 1.5h8v2.5H8zM8.5 4h7v16h-7zM8 20h8v2.5H8zM8.5 7.5l7-2.5v3l-7 2.5zM8.5 13.5l7-2.5v3l-7 2.5z",
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
