export type TokenFile = Record<string, unknown>;
export interface BuildOptions {
  kotlinPackage?: string;
  kotlinLibrary?: boolean;
  /** Set to false to skip Theme.kt; tokens with var() or oklch() colors then build. */
  kotlin?: boolean;
}
/** Generated files by name: tokens.css, theme.css, tailwind.css, fonts.css, and Theme.kt unless `kotlin: false`. */
export function buildTheme(tokens: TokenFile, options?: BuildOptions): Record<string, string>;
export function palettesOf(tokens: TokenFile): Map<string, Record<string, string>>;
export function stylesOf(tokens: TokenFile): unknown;
export function glassOf(tokens: TokenFile): unknown;
export function toKotlinColor(value: string): string;
export function buildTokensCss(tokens: TokenFile): string;
export function buildThemeCss(tokens: TokenFile): string;
export function buildFontsCss(tokens: TokenFile): string;
export function buildThemeKt(
  tokens: TokenFile,
  pkg?: string,
  options?: { library?: boolean },
): string;
