/** Number formatting and count-up tweening. Mirrors the React kit's `NumberValue` math. */
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

export interface AnimateNumberOptions {
  from: number;
  to: number;
  /** Length in ms. Zero, a negative value or `reduced` jumps straight to `to`. */
  duration?: number;
  /** Skips the animation; defaults to the `prefers-reduced-motion` media query. */
  reduced?: boolean;
  ease?: (t: number) => number;
  onFrame: (value: number) => void;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts from `from` to `to` on animation frames, calling `onFrame` with each value (the last one
 * is exactly `to`). Returns a cancel function. Without a DOM, or when motion is reduced, it reports
 * `to` once.
 */
export function animateNumber({
  from,
  to,
  duration = 900,
  reduced = prefersReducedMotion(),
  ease,
  onFrame,
}: AnimateNumberOptions): () => void {
  if (reduced || duration <= 0 || from === to || typeof requestAnimationFrame !== "function") {
    onFrame(to);
    return () => {};
  }
  const t0 = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const progress = (now - t0) / duration;
    onFrame(tweenValue(from, to, progress, ease));
    if (progress < 1) frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
}
