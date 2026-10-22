import type { DefineOptions } from "../internal/base.js";

export * from "../internal/strings.js";

/**
 * Modules in this package export `defineX()`; the registry has nothing to register, so this is a
 * no-op that returns its name. It keeps the entry uniform with the generated index and the checks.
 */
export function defineStrings(_options?: DefineOptions): string {
  return "ui-strings";
}
