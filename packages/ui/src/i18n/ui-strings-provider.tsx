"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type UiLocale, type UiStrings, uiStrings } from "./strings.js";

const UiStringsContext = createContext<UiStrings>(uiStrings.en);

export interface UiStringsProviderProps {
  /** Preset to start from. Without it the provider keeps the strings of its parent (default `en`). */
  locale?: UiLocale;
  /** Overrides applied on top of the preset. */
  strings?: Partial<UiStrings>;
  children: ReactNode;
}

export function UiStringsProvider({ locale, strings, children }: UiStringsProviderProps) {
  const parent = useContext(UiStringsContext);
  const value = useMemo<UiStrings>(
    () => ({ ...(locale ? uiStrings[locale] : parent), ...strings }),
    [locale, strings, parent],
  );
  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>;
}

export function useUiStrings(): UiStrings {
  return useContext(UiStringsContext);
}
