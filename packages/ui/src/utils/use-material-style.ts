"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { Material } from "./material-class.js";

let resolve: typeof import("./material-style.js").withMaterialStyle | undefined;
let loading: Promise<void> | undefined;

const load = () =>
  (loading ??= import("./material-style.js").then(
    (module) => {
      resolve = module.withMaterialStyle;
    },
    () => {
      loading = undefined;
    },
  ));

// A server renders every request from one module instance: loading up front lets its markup carry
// the variables, as it did when they were computed synchronously.
if (typeof window === "undefined") load();

/**
 * The surface props of a `material`: the caller's `style` with the `--liquid-*` variables of a
 * liquid material object under it. Only a material object needs them, so the option mapping
 * (`liquid-options`) is a lazy chunk loaded on first use, and every other material costs nothing.
 * Until it has loaded on the client the surface keeps the theme's liquid look. Server markup
 * carries the variables once the server has loaded it, so the hydration warning for that
 * attribute is silenced.
 */
export function useMaterialStyle(
  material: Material | undefined,
  style?: CSSProperties,
): { style?: CSSProperties; suppressHydrationWarning?: boolean } {
  const [, loaded] = useState(false);
  const object = typeof material === "object";
  // Read at render: when the chunk lands between this render and the effect, it still re-renders.
  const missing = object && !resolve;
  useEffect(() => {
    if (missing) load().then(() => loaded(true));
  }, [missing]);
  if (!object) return { style };
  return { style: resolve ? resolve(material, style) : style, suppressHydrationWarning: true };
}
