import type { ComponentType } from "react";
import type { AuthState } from "../model.js";
import { Slabs } from "./slabs.js";

/** What every illustration variant receives. State and progress come already clamped. */
export interface AuthVariantProps {
  state: AuthState;
  /** Fill of the whole form, 0 to 1. */
  progress: number;
  /** Index of the portal in use (0 to 2). */
  activeIndex: number;
  /** Unique per rendered illustration; use it to prefix SVG ids (patterns, gradients, clip paths). */
  uid: string;
}

export type AuthIllustrationVariant = "slabs";

/**
 * Registry of the looks. A new look is one component with {@link AuthVariantProps} plus an entry
 * here and in {@link AuthIllustrationVariant}. It renders inside a `@container/art` element, so it
 * adapts to the width it is given with `@sm/art:` classes or `@container art (min-width: ...)` rules,
 * and it reads `data-state` from the wrapper for state-driven CSS.
 */
export const AUTH_VARIANTS: Readonly<
  Record<AuthIllustrationVariant, ComponentType<AuthVariantProps>>
> = { slabs: Slabs };
