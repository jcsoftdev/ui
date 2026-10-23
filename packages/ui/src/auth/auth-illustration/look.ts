import type { ComponentType, ReactNode } from "react";
import type { AuthState } from "./model.js";

/** What every illustration look receives. State and progress come already clamped. */
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

/**
 * A look is a component with {@link AuthVariantProps}. It renders inside a `@container/art` element,
 * so it adapts to the width it is given with `@sm/art:` classes or `@container art (min-width: ...)`
 * rules, and it reads `data-state` from the wrapper for state-driven CSS. Two optional static
 * properties describe it to `AuthIllustration` without a registry: `variant` is the name written
 * to `data-variant`, and `text` marks a look made of text people read, which is then not hidden
 * from assistive technology.
 */
export type AuthLook = ComponentType<AuthVariantProps> & {
  variant?: string;
  text?: boolean;
};
