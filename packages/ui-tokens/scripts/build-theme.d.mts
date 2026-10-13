export type TokenFile = Record<string, unknown>;
export interface BuildOptions {
  kotlinPackage?: string;
  kotlinLibrary?: boolean;
}
/** Generated files by name: tokens.css, theme.css, tailwind.css, fonts.css, Theme.kt. */
export function buildTheme(tokens: TokenFile, options?: BuildOptions): Record<string, string>;
export function palettesOf(tokens: TokenFile): Map<string, Record<string, string>>;
export function stylesOf(tokens: TokenFile): unknown;
export function glassOf(tokens: TokenFile): unknown;
export function toKotlinColor(value: string): string;
