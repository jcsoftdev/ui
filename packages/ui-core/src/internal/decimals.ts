/** Digits after the decimal point of a number, exponent notation included. */
export function decimalsOf(n: number): number {
  const [mantissa = "", exponent = "0"] = String(n).split("e");
  return Math.min(100, Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exponent)));
}

/** `n` rounded to `places` decimals, which drops the noise of binary arithmetic (0.1 + 0.2). */
export const roundTo = (n: number, places: number): number => Number(n.toFixed(places));

