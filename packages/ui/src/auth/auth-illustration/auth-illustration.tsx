"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { useOptionalAuth } from "../internal/auth-context.js";
import { AuthStyles } from "../internal/auth-styles.js";
import { Slabs } from "../slabs/slabs.js";
import type { AuthLook } from "./look.js";
import { type AuthState, clamp01, ERROR_HOLD_MS, shownState } from "./model.js";
import { useArtPointer } from "./use-art-pointer.js";

export interface AuthIllustrationProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * The look, a component from its own entry (`Stack` from `@jcsoftdev/ui/auth/stack`, and so on).
   * Defaults to `Slabs`; looks you do not pass stay out of your bundle. For a string `variant`
   * use `AuthIllustrationAny` from `@jcsoftdev/ui/auth/looks`.
   */
  look?: AuthLook;
  /** What the screen is doing. Inside an `AuthLayout` it follows the layout's state. */
  state?: AuthState;
  /** Fill of the whole form, 0 to 1. Inside an `AuthLayout` it follows the layout's progress. */
  progress?: number;
  /** Index of the portal being used (0 to 2); that slab rises above the others. */
  activeIndex?: number;
  /** Accessible name. Without it the illustration is decorative and hidden from assistive technology. */
  label?: string;
  /** Text looks (`Statement`) only: the headline (a string animates word by word). Defaults to the UI string `welcomeBack`. */
  headline?: ReactNode;
  /** Text looks only: a supporting line under the headline. */
  caption?: ReactNode;
  /** Text looks only: content beside the arrow pill, such as a link. */
  action?: ReactNode;
}

/**
 * Isometric illustration of the three portals that reacts to the sign-in state with CSS
 * transitions only. Colours come from the theme tokens (`--accent`, `--surface`, `--ink`), so dark
 * mode and every accent apply on their own. With reduced motion it rests assembled and still.
 */
export function AuthIllustration({
  look: Look = Slabs,
  state: stateProp,
  progress: progressProp,
  activeIndex: activeIndexProp,
  label,
  headline,
  caption,
  action,
  className,
  ...props
}: AuthIllustrationProps) {
  const auth = useOptionalAuth();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const state = stateProp ?? auth?.state ?? "idle";
  const progress = clamp01(progressProp ?? auth?.progress ?? 0);
  const activeIndex = activeIndexProp ?? auth?.activeIndex ?? 0;
  const ref = useRef<HTMLDivElement>(null);
  useArtPointer(ref);
  const [errorHeld, setErrorHeld] = useState(false);
  useEffect(() => {
    setErrorHeld(false);
    if (state !== "error") return;
    const timer = setTimeout(() => setErrorHeld(true), ERROR_HOLD_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const shown = shownState(state, errorHeld);
  return (
    <div
      {...props}
      ref={ref}
      {...(Look.text ? {} : label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      data-state={shown}
      data-panel={auth?.panel}
      data-variant={Look.variant}
      className={cn("ui-auth-art @container/art w-full min-w-0", className)}
    >
      <AuthStyles />
      <Look
        state={shown}
        progress={progress}
        activeIndex={activeIndex}
        uid={uid}
        headline={headline}
        caption={caption}
        action={action}
      />
    </div>
  );
}
