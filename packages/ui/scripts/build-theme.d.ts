export interface ThemeTokens {
  name: string;
  [group: string]: unknown;
}

export interface BuildThemeOptions {
  kotlin?: boolean;
  kotlinPackage?: string;
}

export function buildTokensCss(tokens: ThemeTokens): string;
export function buildThemeCss(tokens: ThemeTokens): string;
export function buildFontsCss(tokens: ThemeTokens): string;
export function buildThemeKt(tokens: ThemeTokens, pkg?: string): string;
export function buildTheme(
  tokens: ThemeTokens,
  options?: BuildThemeOptions,
): Record<string, string>;
