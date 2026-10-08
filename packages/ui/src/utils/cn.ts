import { type ClassValue, clsx } from "clsx";
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

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: TEXT_SIZES }] } },
});

/** Merge class names, resolving conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
