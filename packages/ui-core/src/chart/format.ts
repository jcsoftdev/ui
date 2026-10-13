/**
 * Number formatters for axes, tooltips and labels. Peruvian conventions:
 * dot decimals, a no-break space between thousands ("S/ 1 234.50"), and the
 * Spanish compact form ("1,2 mil").
 */

export type ValueFormatter = (value: number) => string;

/** A preset name or a custom function. */
export type ValueFormat =
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "compact"
  | ValueFormatter;

const NBSP = " ";
const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    cache.set(key, format);
  }
  return format;
}

/** Joins Intl parts, swapping the group separator and literal spaces for a no-break space. */
function spaced(format: Intl.NumberFormat, value: number): string {
  return format
    .formatToParts(value)
    .map((part) =>
      part.type === "group"
        ? NBSP
        : part.type === "literal"
          ? part.value.replace(/\s/g, NBSP)
          : part.value,
    )
    .join("");
}

export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
}

/** "12 345.68" */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { locale = "es-PE", minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;
  return spaced(
    numberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits: Math.max(minimumFractionDigits, maximumFractionDigits),
    }),
    value,
  );
}

export interface CurrencyFormatOptions {
  currency?: string;
  /** Fraction digits, 2 by default. */
  decimals?: number;
  locale?: string;
}

/** "S/ 1 234.50" */
export function formatCurrency(value: number, options: CurrencyFormatOptions = {}): string {
  const { currency = "PEN", decimals = 2, locale = "es-PE" } = options;
  return spaced(
    numberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
    value,
  );
}

export interface PercentFormatOptions {
  /** Maximum fraction digits, 1 by default. */
  decimals?: number;
  /** Read `value` as 0-1 ("fraction", default) or 0-100 ("whole"). */
  input?: "fraction" | "whole";
  locale?: string;
}

/** 0.125 -> "12.5%" */
export function formatPercent(value: number, options: PercentFormatOptions = {}): string {
  const { decimals = 1, input = "fraction", locale = "es-PE" } = options;
  const fraction = input === "whole" ? value / 100 : value;
  return spaced(
    numberFormat(locale, { style: "percent", maximumFractionDigits: decimals }),
    fraction,
  );
}

export interface CompactFormatOptions {
  /** Maximum fraction digits, 1 by default. */
  decimals?: number;
  /** Prefix such as "S/ " for compact money. */
  prefix?: string;
  locale?: string;
}

/** 1234 -> "1,2 mil"; 2500000 -> "2,5 M". Values under 1000 keep their digits. */
export function formatCompact(value: number, options: CompactFormatOptions = {}): string {
  const { decimals = 1, prefix = "", locale = "es" } = options;
  const text = spaced(
    numberFormat(locale, { notation: "compact", maximumFractionDigits: decimals }),
    value,
  );
  return `${prefix}${text}`;
}

/** Turns a `ValueFormat` into a function. Undefined means plain numbers. */
export function resolveFormat(format: ValueFormat | undefined): ValueFormatter {
  if (typeof format === "function") return format;
  switch (format) {
    case "integer":
      return (value) => formatNumber(value, { maximumFractionDigits: 0 });
    case "currency":
      return (value) => formatCurrency(value);
    case "percent":
      return (value) => formatPercent(value);
    case "compact":
      return (value) => formatCompact(value);
    default:
      return (value) => formatNumber(value);
  }
}

/**
 * Shorter variant for axis ticks: currency drops the cents and turns compact
 * from ten thousand up ("S/ 12 mil"); plain numbers turn compact from 10 000.
 */
export function resolveAxisFormat(format: ValueFormat | undefined): ValueFormatter {
  if (typeof format === "function") return format;
  switch (format) {
    case "currency":
      return (value) =>
        Math.abs(value) >= 10_000
          ? formatCompact(value, { prefix: `S/${NBSP}` })
          : formatCurrency(value, { decimals: 0 });
    case "percent":
      return (value) => formatPercent(value, { decimals: 0 });
    default:
      return (value) => (Math.abs(value) >= 10_000 ? formatCompact(value) : formatNumber(value));
  }
}
