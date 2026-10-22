// Shared by the flow charts (sankey, chord, funnel): percent text and the hover-dimming flag.
// Label fitting, JSON attributes and the dev warning live in `chart-text.ts`. No element entry is
// imported here.

const percents = new Map<string, Intl.NumberFormat>();

/** `0.125` as a percent in `locale`, with `digits` fraction digits (`fixed` keeps trailing zeros); non-finite shows as 0. */
export function percentText(value: number, locale: string, digits = 0, fixed = true): string {
  const key = `${locale}|${digits}|${fixed}`;
  let format = percents.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: fixed ? digits : 0,
      maximumFractionDigits: digits,
    });
    percents.set(key, format);
  }
  return format.format(Number.isFinite(value) ? value : 0);
}

/** The sankey and table style: one decimal under 10%, none above. */
export const sharePercent = (value: number, locale: string): string =>
  percentText(value, locale, value < 0.1 ? 1 : 0);

/** Sets `data-dim` on every element whose key is not in `lit`; `null` clears the dimming. */
export function dimExcept<K>(
  items: ReadonlyArray<{ key: K; els: ReadonlyArray<Element | undefined> }>,
  lit: ReadonlySet<K> | null,
): void {
  for (const { key, els } of items)
    for (const el of els) el?.toggleAttribute("data-dim", lit !== null && !lit.has(key));
}
