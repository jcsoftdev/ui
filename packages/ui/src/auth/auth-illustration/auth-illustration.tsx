"use client";

import { type ComponentPropsWithoutRef, useId } from "react";
import { cn } from "../../utils/cn.js";
import { useOptionalAuth } from "../internal/auth-context.js";
import { AuthStyles } from "../internal/auth-styles.js";
import { type AuthState, clamp01 } from "./model.js";
import { AUTH_VARIANTS, type AuthIllustrationVariant } from "./variants/index.js";

export interface AuthIllustrationProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** The look of the illustration. Defaults to `slabs`. */
  variant?: AuthIllustrationVariant;
  /** What the screen is doing. Inside an `AuthLayout` it follows the layout's state. */
  state?: AuthState;
  /** Fill of the whole form, 0 to 1. Inside an `AuthLayout` it follows the layout's progress. */
  progress?: number;
  /** Index of the portal being used (0 to 2); that slab rises above the others. */
  activeIndex?: number;
  /** Accessible name. Without it the illustration is decorative and hidden from assistive technology. */
  label?: string;
}

/**
 * Isometric illustration of the three portals that reacts to the sign-in state with CSS
 * transitions only. Colours come from the theme tokens (`--accent`, `--surface`, `--ink`), so dark
 * mode and every accent apply on their own. With reduced motion it rests assembled and still.
 */
export function AuthIllustration({
  variant = "slabs",
  state: stateProp,
  progress: progressProp,
  activeIndex: activeIndexProp,
  label,
  className,
  ...props
}: AuthIllustrationProps) {
  const auth = useOptionalAuth();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const Look = AUTH_VARIANTS[variant];
  const state = stateProp ?? auth?.state ?? "idle";
  const progress = clamp01(progressProp ?? auth?.progress ?? 0);
  const activeIndex = activeIndexProp ?? auth?.activeIndex ?? 0;
  return (
    <div
      {...props}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      data-state={state}
      data-panel={auth?.panel}
      data-variant={variant}
      className={cn("ui-auth-art @container/art w-full min-w-0", className)}
    >
      <AuthStyles />
      <Look state={state} progress={progress} activeIndex={activeIndex} uid={uid} />
    </div>
  );
}
