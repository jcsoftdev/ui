import {
  type ContextKey,
  consumeContext,
  createContextKey,
  provideContext,
} from "@jcsoftdev/ui-core/context";

/**
 * Strings registry: the i18n layer of the elements, as a plain module (no tag). It is opt-in and
 * tree-shakeable: an element that never imports `@jcsoftdev/ui-elements/strings` pays nothing for it,
 * and the Spanish pack is a lazy chunk fetched only by `loadStrings("es")`.
 *
 * Resolution order for `resolveString(host, key, fallback, attr)`:
 *
 * 1. the element's own attribute (`attr`), for a one-off override;
 * 2. the nearest `provideStrings(ancestor, partial)` above the element (a subtree override);
 * 3. the registry for the nearest `lang` (`es-PE`, then `es`), filled by `setStrings` / `loadStrings`;
 * 4. the English `fallback` the element passes, then the built-in English core pack, then the key.
 *
 * Elements keep their own English defaults and pass them as `fallback`, so a component never needs
 * the registry to render and the core pack stays at a dozen strings.
 */
export type StringMap = Record<string, string>;

/** The strings shared by the kit (same keys and values as the React kit's `UiStrings`). */
export const coreStrings = {
  retry: "Retry",
  close: "Close",
  loading: "Loading",
  optional: "optional",
  cancel: "Cancel",
  confirm: "Confirm",
  processing: "Processing…",
  correlationPrefix: "ID:",
  actionFailed: "The action could not be completed. Try again.",
  somethingWrong: "Something went wrong. Try again.",
  actions: "Actions",
  notifications: "Notifications",
} as const satisfies StringMap;

export type CoreStringKey = keyof typeof coreStrings;

const registry = new Map<string, StringMap>();
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of [...listeners]) listener();
};

/** Merges `partial` into the pack for `locale` (`"es"`, `"es-PE"`) and notifies watchers. */
export function setStrings(locale: string, partial: StringMap): void {
  const key = locale.toLowerCase();
  registry.set(key, { ...registry.get(key), ...partial });
  changed();
}

/** The merged pack registered for exactly `locale`, or `undefined`. */
export function getStrings(locale: string): Readonly<StringMap> | undefined {
  return registry.get(locale.toLowerCase());
}

/** Drops the pack for `locale` (or every pack) and notifies watchers. */
export function clearStrings(locale?: string): void {
  if (locale === undefined) registry.clear();
  else registry.delete(locale.toLowerCase());
  changed();
}

const loaders = new Map<string, () => Promise<StringMap>>([
  ["es", async () => (await import("../strings/es.js")).es],
]);

/**
 * Registers a built-in pack on demand (`"es"` today). The pack lives in its own chunk, so a page
 * that never calls this never downloads it. Unknown locales resolve without changes.
 */
export async function loadStrings(locale: string): Promise<void> {
  const base = locale.toLowerCase().split("-")[0] as string;
  const load = loaders.get(base);
  if (load) setStrings(base, await load());
}

/** The locale that applies to `host`: the nearest `lang` through shadow roots, else the document's. */
export function localeOf(host: Element): string {
  let node: Element | null = host;
  while (node) {
    const lang = node.getAttribute("lang");
    // An empty `lang` means "unknown language" in HTML: stop the walk and use the default.
    if (lang !== null) return lang.toLowerCase() || "en";
    node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null;
  }
  return (
    (typeof document === "undefined" ? "" : document.documentElement.lang).toLowerCase() || "en"
  );
}

const own = (pack: StringMap | undefined, key: string): string | undefined =>
  pack && Object.hasOwn(pack, key) ? pack[key] : undefined;

const lookup = (locale: string, key: string): string | undefined =>
  own(registry.get(locale), key) ?? own(registry.get(locale.split("-")[0] as string), key);

const STRINGS_CONTEXT: ContextKey<StringMap> = createContextKey<StringMap>("ui-strings");

/** Makes `host` override strings for its whole subtree and notifies watchers. Returns a cleanup. */
export function provideStrings(host: Element, partial: StringMap): () => void {
  const provider = provideContext<StringMap>(host, STRINGS_CONTEXT, partial);
  changed();
  return () => {
    provider.destroy();
    changed();
  };
}

function provided(host: Element, key: string): string | undefined {
  let found: StringMap | undefined;
  consumeContext(host, STRINGS_CONTEXT, (value) => {
    found = value;
  })?.();
  return own(found, key);
}

/**
 * The string for `key` on `host`, following the resolution order above. `fallback` is the
 * element's English default; `attr` is the attribute that overrides it on the element itself.
 */
export function resolveString(
  host: Element,
  key: string,
  fallback?: string,
  attr?: string,
): string {
  const own = attr ? host.getAttribute(attr) : null;
  if (own !== null) return own;
  return (
    provided(host, key) ??
    lookup(localeOf(host), key) ??
    fallback ??
    (coreStrings as StringMap)[key] ??
    key
  );
}

/**
 * Calls `callback` whenever the registry changes (`setStrings`, `loadStrings`, `clearStrings`) so
 * the element can re-render its labels. Returns a cleanup; call it from `disconnectedCallback`.
 */
export function watchStrings(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
