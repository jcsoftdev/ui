/** Whether a default-on boolean attribute is on: absent or anything but `"false"`. */
export const attrOn = (element: Element, name: string): boolean =>
  element.getAttribute(name) !== "false";

/** Parses a finite number attribute; `fallback` when it is absent or not numeric. */
export function attrNumber(element: Element, name: string, fallback: number): number;
export function attrNumber(element: Element, name: string): number | undefined;
export function attrNumber(element: Element, name: string, fallback?: number): number | undefined {
  const raw = element.getAttribute(name);
  const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Parses a JSON object attribute; `undefined` when it is absent or malformed. */
export function attrJson<T extends object>(element: Element, name: string): T | undefined {
  const raw = element.getAttribute(name);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}
