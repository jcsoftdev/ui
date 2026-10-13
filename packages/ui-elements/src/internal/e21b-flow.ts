// Shared by the flow charts (sankey, chord, funnel): attribute JSON, percent text, label fitting
// and the hover-dimming flag. No element entry is imported here.

const percents = new Map<string, Intl.NumberFormat>();

/** `0.125` as a percent in `locale`, with `digits` fraction digits (`fixed` keeps trailing zeros). */
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

/** Parses a JSON attribute; `undefined` when it is missing or malformed. */
export function jsonAttr<T>(element: Element, name: string): T | undefined {
  const text = element.getAttribute(name);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** A finite number attribute, else `fallback`. */
export function numberAttr(element: Element, name: string, fallback: number): number {
  const text = element.getAttribute(name);
  const value = text == null || text.trim() === "" ? Number.NaN : Number(text);
  return Number.isFinite(value) ? value : fallback;
}

/** Label that fits in `maxWidth`: the full text, a shortened one with an ellipsis, or `null`. */
export function fitLabel(text: string, maxWidth: number, fontSize = 12): string | null {
  const charWidth = fontSize * 0.58;
  if (text.length * charWidth <= maxWidth) return text;
  const chars = Math.floor(maxWidth / charWidth) - 1;
  return chars >= 4 ? `${text.slice(0, chars).trimEnd()}…` : null;
}

export const textWidth = (text: string, fontSize = 11): number => text.length * fontSize * 0.58;

/** Sets `data-dim` on every element whose key is not in `lit`; `null` clears the dimming. */
export function dimExcept<K>(
  items: ReadonlyArray<{ key: K; els: ReadonlyArray<Element | undefined> }>,
  lit: ReadonlySet<K> | null,
): void {
  for (const { key, els } of items)
    for (const el of els) el?.toggleAttribute("data-dim", lit !== null && !lit.has(key));
}

/** Production builds stay quiet. */
export function devWarn(message: string): void {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  if (env !== "production") console.warn(message);
}

/** A JSON attribute reader that parses each distinct attribute text once. */
export function cachedJson(element: Element): <T>(name: string) => T | undefined {
  const seen = new Map<string, { text: string; value: unknown }>();
  return <T>(name: string): T | undefined => {
    const text = element.getAttribute(name);
    if (text == null) return undefined;
    const hit = seen.get(name);
    if (hit?.text === text) return hit.value as T | undefined;
    const value = jsonAttr<T>(element, name);
    seen.set(name, { text, value });
    return value;
  };
}
