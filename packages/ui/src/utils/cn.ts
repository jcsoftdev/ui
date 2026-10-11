import { extendTailwindMerge } from "tailwind-merge";

/** Custom `text-*` size tokens from theme.css; without them twMerge reads them as colors. */
const TEXT_SIZES = [
  "kpi-number",
  "page-title",
  "dialog-title",
  "card-title",
  "lede",
  "body",
  "row-title",
  "control",
  "meta",
  "chip-text",
  "overline",
  "clock",
  "data",
  "count",
  "m-title",
  "m-card-title",
  "m-row-title",
  "m-body",
  "m-button",
  "m-meta",
];

/** Role radii and legacy radius names from theme.css (`rounded-*`). */
const RADII = [
  "xs",
  "chip",
  "event",
  "control",
  "tile",
  "banner",
  "card",
  "dialog",
  "sheet",
  "pill",
  "button",
  "input",
  "badge",
  "avatar",
  "popover",
];

/** Role shadows and legacy shadow names from theme.css (`shadow-*`). */
const SHADOWS = [
  "flat",
  "hero",
  "cta",
  "sel",
  "pop",
  "card",
  "raised",
  "overlay",
  "control",
  "selected",
  "inset",
  "inset-accent",
  "pinned-start",
  "pinned-end",
];

/** Density-aware sizes from theme.css, used by `h-*`, `p-*`, `px-*` and `gap-*`. */
const SPACINGS = [
  "control",
  "control-sm",
  "input",
  "control-x",
  "card",
  "density-sm",
  "density",
  "density-lg",
  "control-height",
  "control-height-sm",
  "input-height",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: { radius: RADII, shadow: SHADOWS, spacing: SPACINGS },
    classGroups: {
      "font-size": [{ text: TEXT_SIZES }],
      // Preset edges set width, style and color together; a later `border-2` or `border-0` wins.
      "border-w": [{ border: ["card", "control", "divider"] }],
    },
  },
});

export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassArray;
export type ClassDictionary = Record<string, unknown>;
export type ClassArray = ClassValue[];

/** Join class values (strings, numbers, arrays, objects) skipping falsy ones; clsx-compatible. */
function clsx(...inputs: ClassValue[]): string {
  let out = "";
  for (const input of inputs) {
    const part = toClass(input);
    if (part) out += (out ? " " : "") + part;
  }
  return out;
}

function toClass(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value !== "object") return "";
  if (Array.isArray(value)) return clsx(...value);
  let out = "";
  for (const key of Object.keys(value)) {
    if (value[key]) out += (out ? " " : "") + key;
  }
  return out;
}

/** Merge class names, resolving conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
