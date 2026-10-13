const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns the normalized URL when its protocol is http, https or mailto; otherwise null. */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
