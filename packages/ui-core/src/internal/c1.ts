/**
 * One instance per `key` across every copy of the package on the page (duplicate installs, split
 * bundles), so lock and hide state stay shared. Same contract as the React kit's `globalSingleton`.
 */
export function globalSingleton<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<symbol, unknown>;
  const symbol = Symbol.for(key);
  if (!(symbol in store)) store[symbol] = create();
  return store[symbol] as T;
}
