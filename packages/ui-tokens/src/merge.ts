import type { Theme } from "./types.ts";

type TokenFile = { color?: { tokens?: { name: string }[] } } & Record<string, unknown>;

/**
 * Returns `base` (for example tokens/default.json) with its color tokens replaced by the theme's.
 * Tokens the theme does not define (the `pal-*` accent presets) are kept, so `data-accent` keeps working.
 */
export function withTheme<T extends TokenFile>(base: T, theme: Theme): T & { name: string } {
  const generated = new Set(theme.color.tokens.map((t) => t.name));
  const kept = (base.color?.tokens ?? []).filter((t) => !generated.has(t.name));
  const tokens = [...theme.color.tokens, ...kept] as unknown[];
  return {
    ...base,
    name: theme.name,
    color: { ...(base.color ?? {}), themes: theme.color.themes, tokens },
  } as T & { name: string };
}
