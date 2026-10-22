import type { ComponentPropsWithRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

/** Class map behind each named `size`; exported like `buttonSizeClasses`. */
export const spinnerSizeClasses: Readonly<Record<SpinnerSize, string>> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

export interface SpinnerProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Named size, or a pixel size for one-offs. Defaults to `sm`. */
  size?: SpinnerSize | number;
  /**
   * Accessible name announced through `role="status"`. Defaults to the localized `loading` UI
   * string. `false` marks the spinner decorative (`aria-hidden`), for use next to its own text.
   */
  label?: string | false;
}

/**
 * Indeterminate activity indicator drawn with the current text color. It spins only when the user
 * has not asked for reduced motion; otherwise it stays a static ring and the label still says
 * that work is in progress.
 */
export function Spinner({ size = "sm", label, className, style, ...props }: SpinnerProps) {
  const strings = useUiStrings();
  const named = typeof size === "string";
  const a11y =
    label === false
      ? ({ "aria-hidden": true } as const)
      : ({ role: "status", "aria-label": label ?? strings.loading } as const);
  return (
    <span
      {...a11y}
      {...props}
      style={named ? style : { width: size, height: size, ...style }}
      className={cn(
        "inline-block shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin",
        named && spinnerSizeClasses[size],
        className,
      )}
    />
  );
}
