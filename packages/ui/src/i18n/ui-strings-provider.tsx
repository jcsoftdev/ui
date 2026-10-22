"use client";

import { type Context, createContext, type ReactNode, useContext, useMemo } from "react";
import { type UiLocale, type UiStrings, uiStrings } from "./strings.js";

// One context per page even when the module is instantiated twice (a linked package, a dual
// bundle, a test runner that inlines one entry and externalizes another): a provider mounted through
// one copy must reach components imported through the other.
const registry = Symbol.for("@jcsoftdev/ui/i18n/strings");
const shared = globalThis as typeof globalThis & { [registry]?: Context<UiStrings> };
const UiStringsContext: Context<UiStrings> =
  shared[registry] ?? createContext<UiStrings>(uiStrings.en);
shared[registry] = UiStringsContext;

/** Drops `undefined` and empty entries so a partial value never blanks a preset string. */
const defined = (strings?: Partial<UiStrings>): Partial<UiStrings> =>
  Object.fromEntries(Object.entries(strings ?? {}).filter(([, value]) => value));

export interface UiStringsProviderProps {
  /** Preset to start from. Without it the provider keeps the strings of its parent (default `en`). */
  locale?: UiLocale;
  /** Overrides applied on top of the preset. Missing or empty entries keep the preset string. */
  strings?: Partial<UiStrings>;
  children: ReactNode;
}

export function UiStringsProvider({ locale, strings, children }: UiStringsProviderProps) {
  const parent = useContext(UiStringsContext);
  const value = useMemo<UiStrings>(
    () => ({ ...(locale ? uiStrings[locale] : parent), ...defined(strings) }),
    [locale, strings, parent],
  );
  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>;
}

export function useUiStrings(): UiStrings {
  return useContext(UiStringsContext);
}
