/**
 * One instance per `key` across every copy of this module on the page (duplicate
 * package installs, split bundles), so layer, scroll-lock and hide state stay shared.
 */
export function globalSingleton<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<symbol, unknown>;
  const symbol = Symbol.for(key);
  if (!(symbol in store)) store[symbol] = create();
  return store[symbol] as T;
}
