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
import { type AuthState, clamp01, ERROR_HOLD_MS, shownState } from "./model.js";
import { useArtPointer } from "./use-art-pointer.js";
import { AUTH_VARIANTS, type AuthIllustrationVariant, TEXT_VARIANTS } from "./variants/index.js";

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
  /** `statement` only: the headline (a string animates word by word). Defaults to the UI string `welcomeBack`. */
  headline?: ReactNode;
  /** `statement` only: a supporting line under the headline. */
  caption?: ReactNode;
  /** `statement` only: content beside the arrow pill, such as a link. */
  action?: ReactNode;
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
  headline,
  caption,
  action,
  className,
  ...props
}: AuthIllustrationProps) {
  const auth = useOptionalAuth();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const Look = AUTH_VARIANTS[variant];
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
      {...(TEXT_VARIANTS.has(variant)
        ? {}
        : label
          ? { role: "img", "aria-label": label }
          : { "aria-hidden": true })}
      data-state={shown}
      data-panel={auth?.panel}
      data-variant={variant}
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
