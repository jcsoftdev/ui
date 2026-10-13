"use client";

import type { ComponentPropsWithoutRef, Ref } from "react";
import { useGlassLens } from "../../glass/use-glass-lens.js";
import type { Material } from "../../utils/material-class.js";
import { useMaterialStyle } from "../../utils/use-material-style.js";

export interface CardLensProps extends ComponentPropsWithoutRef<"div"> {
  ref?: Ref<HTMLDivElement>;
  material?: Material;
}

/**
 * The surface of a `Card` that is glass. It is the only client part of the card: an opaque
 * `Card` stays a plain server component, and only a glass one loads the lens hook.
 */
export function CardLens({ ref, material, style, ...props }: CardLensProps) {
  const lens = useGlassLens(ref);
  const materialProps = useMaterialStyle(material, style);
  return <div ref={lens} {...materialProps} {...props} />;
}
