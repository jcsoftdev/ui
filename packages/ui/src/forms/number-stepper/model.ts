import { snapToStep } from "../slider/model.js";

/** A typed number: dot or comma decimal, `NaN` for empty or unreadable text ("", "-"). */
export function parseNumber(text: string): number {
  const trimmed = text.trim().replace(",", ".");
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

/**
 * The text after stepping `text` by `direction` steps, kept within `min`/`max` and on the step grid.
 * An empty or unreadable text goes to `min` when there is one, else to one step in `direction`.
 */
export function stepText(
  text: string,
  direction: 1 | -1,
  limits: { min: number; max: number; step: number },
): string {
  const { min, max, step } = limits;
  const parsed = parseNumber(text);
  if (Number.isNaN(parsed)) {
    return String(snapToStep(Number.isFinite(min) ? min : direction * step, min, max, step));
  }
  return String(snapToStep(parsed + direction * step, min, max, step));
}

/** Whether another step in `direction` would stay within the limits, for the buttons. */
export function canStep(
  text: string,
  direction: 1 | -1,
  limits: { min: number; max: number },
): boolean {
  const parsed = parseNumber(text);
  if (Number.isNaN(parsed)) return true;
  return direction === 1 ? parsed < limits.max : parsed > limits.min;
}
