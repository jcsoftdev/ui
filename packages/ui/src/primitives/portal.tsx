"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** Renders into `container` (default `document.body`); nothing on the server or before hydration. */
export function Portal({
  children,
  container,
}: {
  children?: ReactNode;
  container?: HTMLElement | null;
}) {
  const isClient = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!isClient) return null;
  return createPortal(children, container ?? document.body);
}
