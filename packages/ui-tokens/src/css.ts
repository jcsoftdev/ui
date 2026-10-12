import type { Scheme, Theme, ToCssOptions } from "./types.ts";

const block = (selector: string, theme: Theme, scheme: Scheme) =>
  `${selector} {\n${theme.color.tokens.map((t) => `  --${t.name}: ${t.value[scheme]};`).join("\n")}\n}`;

/**
 * Serializes a theme's color tokens as CSS custom properties. Pure string output, safe to call
 * on the server. `selector` must be a trusted CSS selector (it is not escaped).
 */
export function toCss(
  theme: Theme,
  { selector = ":root", scheme = "auto" }: ToCssOptions = {},
): string {
  if (scheme === "light" || scheme === "dark") return `${block(selector, theme, scheme)}\n`;
  const notLight = `${selector}:not([data-theme="light"]):not([data-theme="light"] *)`;
  const forcedDark = `${selector}[data-theme="dark"],\n[data-theme="dark"] ${selector}`;
  const indented = block(notLight, theme, "dark")
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
  return [
    block(selector, theme, "light"),
    `@media (prefers-color-scheme: dark) {\n${indented}\n}`,
    block(forcedDark, theme, "dark"),
    "",
  ].join("\n");
}
