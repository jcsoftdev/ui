"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef, useState } from "react";

type FocusTarget = HTMLElement | null;
export type FocusRef = { current: FocusTarget };

const PreviousFocusContext = createContext<FocusRef | null>(null);

/**
 * Radix can only return focus to the opener of a Dialog/Drawer when that opener
 * is the component's own `Trigger`. Controlled overlays (`open`/`onOpenChange`
 * driven by a parent, no `Trigger`) would leave focus orphaned on `<body>`.
 *
 * The active element is captured during RENDER, in the same commit where `open`
 * flips to `true`, before Radix's inner focus scope moves focus into the content.
 */
export function useCapturePreviousFocus(open: boolean | undefined): FocusRef {
  const focusRef = useRef<FocusTarget>(null);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    if (open) focusRef.current = document.activeElement as FocusTarget;
    setPreviousOpen(open);
  }
  return focusRef;
}

export function PreviousFocusProvider({
  focusRef,
  children,
}: {
  focusRef: FocusRef;
  children: ReactNode;
}) {
  return <PreviousFocusContext.Provider value={focusRef}>{children}</PreviousFocusContext.Provider>;
}

export function usePreviousFocus(): FocusRef | null {
  return useContext(PreviousFocusContext);
}

interface AutoFocusEvent {
  defaultPrevented: boolean;
  preventDefault: () => void;
}

/**
 * Compose inside `onCloseAutoFocus` of a `*.Content`. Does nothing if the caller
 * already prevented the event, or if no previous focus was captured (the overlay
 * was opened by its own `Trigger`, which Radix restores by itself).
 */
export function restoreFocusOnClose(event: AutoFocusEvent, focusRef: FocusRef | null): void {
  if (event.defaultPrevented) return;
  const element = focusRef?.current;
  if (element && document.contains(element)) {
    event.preventDefault();
    element.focus();
  }
}
