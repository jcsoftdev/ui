import type { ComponentPropsWithRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

/** `sm` (30px) and `md` (38px) are the heights every control shares; `xs` is the older name of `sm`. */
export type InputSize = "xs" | "sm" | "md" | "lg";
export type InputVariant = "default" | "bare";
export type InputPart = "root" | "start" | "end" | "input";

const height: Readonly<Record<InputSize, string>> = {
  xs: "h-control-sm",
  sm: "h-control-sm",
  md: "h-control-md",
  lg: "h-control-lg text-fs-140",
};
const paddingX: Readonly<Record<InputSize, string>> = {
  xs: "px-2.5",
  sm: "px-2.5",
  md: "px-3",
  lg: "px-4",
};

export const inputSizeClasses: Readonly<Record<InputSize, string>> = {
  xs: `${height.xs} ${paddingX.xs}`,
  sm: `${height.sm} ${paddingX.sm}`,
  md: `${height.md} ${paddingX.md}`,
  lg: `${height.lg} ${paddingX.lg}`,
};

const CHROME = "rounded-input border-control bg-surface-control";
const TEXT = "min-w-0 text-control text-ink placeholder:text-ink-3";
const RING =
  "focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1";
const INVALID = "aria-[invalid=true]:border-danger";

export interface InputProps extends Omit<ComponentPropsWithRef<"input">, "size"> {
  /**
   * `sm` is the 30px compact field and `md` (default) the 38px one: the heights of `Button` `sm` and
   * `md`. `xs` is the same as `sm`; `lg` is the thumb-friendly field.
   */
  size?: InputSize;
  /** `bare` drops the border, background and side padding, for a field that sits inside chrome of its own. */
  variant?: InputVariant;
  /** Content before the text (an icon, a currency symbol, a button). Adds a wrapper that draws the field. */
  start?: ReactNode;
  /** Content after the text (an icon, a unit, a clear or reveal button). Adds a wrapper that draws the field. */
  end?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. Parts other than `input` only exist with `start` or `end`. */
  classNames?: ClassNames<InputPart>;
}

/**
 * Text field. With `start` or `end` the field is drawn by a wrapper, so `className` then targets that
 * wrapper (its width, margins) and `classNames.input` the `<input>`; without them `className` stays on
 * the `<input>` as before.
 */
export function Input({
  size = "md",
  variant = "default",
  start,
  end,
  className,
  classNames,
  ...props
}: InputProps) {
  const bare = variant === "bare";

  if (start == null && end == null) {
    return (
      <input
        className={cn(
          "w-full",
          TEXT,
          bare
            ? [
                height[size],
                "bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-accent-ink",
              ]
            : [CHROME, RING, INVALID, inputSizeClasses[size]],
          classNames?.input,
          className,
        )}
        {...props}
      />
    );
  }

  const adornment = "flex shrink-0 items-center text-ink-3 [&>svg]:size-4";
  return (
    <span
      className={cn(
        "flex w-full min-w-0 items-center gap-2",
        height[size],
        bare
          ? "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent-ink"
          : [
              CHROME,
              paddingX[size],
              "focus-within:border-transparent focus-within:outline-2 focus-within:outline-accent-ink focus-within:-outline-offset-1 has-[input[aria-invalid=true]]:border-danger",
            ],
        "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        classNames?.root,
        className,
      )}
    >
      {start != null ? <span className={cn(adornment, classNames?.start)}>{start}</span> : null}
      <input
        className={cn(
          "h-full flex-1 bg-transparent outline-none",
          TEXT,
          size === "lg" && "text-fs-140",
          classNames?.input,
        )}
        {...props}
        // The wrapper draws the ring; the unlayered base `:focus-visible` rule outranks `outline-none`.
        style={{ outline: "none", ...props.style }}
      />
      {end != null ? <span className={cn(adornment, classNames?.end)}>{end}</span> : null}
    </span>
  );
}
