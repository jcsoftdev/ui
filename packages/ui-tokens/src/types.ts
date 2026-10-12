export type Scheme = "light" | "dark";

export interface ThemeToken {
  name: string;
  value: Record<Scheme, string>;
  usage: string;
}

/** Same shape as the `color` and header sections of tokens/default.json. */
export interface Theme {
  name: string;
  version: 2;
  color: {
    themes: { id: Scheme; name: string }[];
    tokens: ThemeToken[];
  };
}

export interface ThemeSeeds {
  /** Primary action color, `#rgb` or `#rrggbb`. */
  brand: string;
  /** Neighbour tone used for `accent-2`. Defaults to the brand hue shifted by 38 degrees. */
  accent?: string;
  /** Hue (and a little chroma) used to tint grays. Defaults to the brand hue, nearly neutral. */
  neutral?: string;
  /** Overrides the error color's hue and chroma. */
  danger?: string;
  /** Contrast guarantee. Only WCAG 2 AA exists in v1. */
  contrast?: "AA";
  /** Written to the token file's `name`. */
  name?: string;
}

export interface ToCssOptions {
  /** Selector that receives the variables. Defaults to `:root`. */
  selector?: string;
  /**
   * `light` or `dark` emit one block. `auto` (default) emits light, then dark under
   * `prefers-color-scheme` and `[data-theme="dark"]`, mirroring tokens.css.
   */
  scheme?: Scheme | "auto";
}
