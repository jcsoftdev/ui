import type { ComponentType, ReactNode } from "react";
import type { AuthState } from "../model.js";
import { Character } from "./character.js";
import { Mosaic } from "./mosaic.js";
import { Slabs } from "./slabs.js";
import { Stack } from "./stack.js";
import { Statement } from "./statement.js";

/** What every illustration variant receives. State and progress come already clamped. */
export interface AuthVariantProps {
  state: AuthState;
  /** Fill of the whole form, 0 to 1. */
  progress: number;
  /** Index of the portal in use (0 to 2). */
  activeIndex: number;
  /** Unique per rendered illustration; use it to prefix SVG ids (patterns, gradients, clip paths). */
  uid: string;
  /** Text looks only (`statement`): the main line; a string animates word by word. */
  headline?: ReactNode;
  /** Text looks only: a supporting line under the headline. */
  caption?: ReactNode;
  /** Text looks only: content placed beside the arrow pill, such as a link. */
  action?: ReactNode;
}

/** Looks whose content is text people read; they are not hidden from assistive technology. */
export const TEXT_VARIANTS: ReadonlySet<AuthIllustrationVariant> = new Set(["statement"]);

export type AuthIllustrationVariant = "slabs" | "stack" | "mosaic" | "character" | "statement";

/**
 * Registry of the looks. A new look is one component with {@link AuthVariantProps} plus an entry
 * here and in {@link AuthIllustrationVariant}. It renders inside a `@container/art` element, so it
 * adapts to the width it is given with `@sm/art:` classes or `@container art (min-width: ...)` rules,
 * and it reads `data-state` from the wrapper for state-driven CSS.
 */
export const AUTH_VARIANTS: Readonly<
  Record<AuthIllustrationVariant, ComponentType<AuthVariantProps>>
> = { slabs: Slabs, stack: Stack, mosaic: Mosaic, character: Character, statement: Statement };
