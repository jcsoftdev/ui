export interface NumberFormatConfig extends Intl.NumberFormatOptions {
  /** BCP 47 locale. Defaults to Peruvian Spanish. */
  locale?: string;
}

export const DEFAULT_LOCALE = "es-PE";

/** Locale-aware number formatting (currency, percent, compact, units via Intl options). */
export function formatNumber(value: number, config: NumberFormatConfig = {}): string {
  const { locale = DEFAULT_LOCALE, ...options } = config;
  return new Intl.NumberFormat(locale, options).format(value);
}

export function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - (1 - p) ** 3;
}

/** Value between `from` and `to` at linear `progress` (0..1), eased. */
export function tweenValue(
  from: number,
  to: number,
  progress: number,
  ease: (t: number) => number = easeOutCubic,
): number {
  if (progress >= 1) return to;
  return from + (to - from) * ease(progress);
}
