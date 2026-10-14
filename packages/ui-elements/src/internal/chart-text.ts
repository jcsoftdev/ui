/**
 * Small helpers shared by the hierarchy, tree and flow charts: label fitting, JSON attributes, the
 * easing of a zoom and the development warning. No DOM beyond the element a reader is given.
 */

/** Width of `text` in `fontSize` px, estimated (no layout). */
export const textWidth = (text: string, fontSize = 11): number => text.length * fontSize * 0.58;

/** The text, a shortened one with an ellipsis, or `null` when not even four characters fit. */
export function fitLabel(text: string, maxWidth: number, fontSize = 12): string | null {
  const charWidth = fontSize * 0.58;
  if (text.length * charWidth <= maxWidth) return text;
  const chars = Math.floor(maxWidth / charWidth) - 1;
  return chars >= 4 ? `${text.slice(0, chars).trimEnd()}…` : null;
}

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

/** A warning for developers; production builds stay quiet. */
export function devWarn(message: string): void {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  if (env !== "production") console.warn(message);
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
