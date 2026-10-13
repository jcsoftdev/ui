"use client";

import type { ComponentPropsWithoutRef, Ref } from "react";
import { useGlassLens } from "../../glass/use-glass-lens.js";

export interface CardLensProps extends ComponentPropsWithoutRef<"div"> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * The surface of a `Card` that is glass. It is the only client part of the card: an opaque
 * `Card` stays a plain server component, and only a glass one loads the lens hook.
 */
export function CardLens({ ref, ...props }: CardLensProps) {
  const lens = useGlassLens(ref);
  return <div ref={lens} {...props} />;
}
