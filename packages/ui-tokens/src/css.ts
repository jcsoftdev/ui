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
  // Everything except the caller's selector sits inside :where(), which has zero specificity, so
  // every generated rule weighs exactly as much as `selector` itself. That keeps overrides such as
  // `:root[data-accent="menta"]` (0,2,0) ahead of the generated dark values; order alone settles
  // light vs dark between the generated blocks.
  const notLight = `${selector}:where(:not([data-theme="light"]):not([data-theme="light"] *))`;
  const forcedDark = `${selector}:where([data-theme="dark"]),\n:where([data-theme="dark"]) ${selector}`;
  // A forced scheme on a descendant must win over the value it would inherit from `selector`.
  const nestedLight = `${selector} :where([data-theme="light"])`;
  const nestedDark = `${selector} :where([data-theme="dark"])`;
  const indented = block(notLight, theme, "dark")
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
  return [
    block(selector, theme, "light"),
    `@media (prefers-color-scheme: dark) {\n${indented}\n}`,
    block(forcedDark, theme, "dark"),
    block(nestedLight, theme, "light"),
    block(nestedDark, theme, "dark"),
    "",
  ].join("\n");
}
