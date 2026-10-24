"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";
import { type StatusTone, statusIcon } from "../internal/status-icons.js";

export type ChipBuiltinTone =
  | "neutral"
  | "danger"
  | "warning"
  | "success"
  | "accent"
  | "info"
  | "solid"
  | "outline";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type ChipTone = ChipBuiltinTone | (string & {});

/** Class map behind each `tone`; exported so apps can extend or reuse it. */
export const chipToneClasses: Readonly<Record<ChipBuiltinTone, string>> = {
  neutral: "bg-surface-2 text-ink-2",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent-ink",
  info: "bg-info-soft text-info",
  solid: "bg-accent text-on-accent",
  outline: "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
};

export type ChipSize = "sm" | "md";

/** Class map behind each `size`; exported like `chipToneClasses`. */
export const chipSizeClasses: Readonly<Record<ChipSize, string>> = {
  md: "h-6 px-2.5 font-[650] text-fs-120",
  sm: "h-auto min-h-5 px-1.5 py-px font-medium text-fs-115 tabular-nums",
};

export interface ChipProps extends ComponentPropsWithRef<"span"> {
  tone?: ChipTone;
  /**
   * `sm` is the compact tag: it grows with its content, tightens the padding and uses tabular
   * numerals, so codes, counts and ids line up. Pair it with `square` and a neutral tone for a tag.
   */
  size?: ChipSize;
  /** Use the smaller chip radius instead of a full pill. */
  square?: boolean;
  /** Leading decorative icon; wins over `statusIcon`. */
  icon?: ReactNode;
  /** Prefix `info`, `success`, `warning` and `danger` chips with their status glyph. */
  statusIcon?: boolean;
  /**
   * A chip with `onClick` (or `role="button"`) is interactive and never shorter than 30px
   * (`--control-height-sm`), the smallest hit area of the kit, whatever its `size`.
   */
  onClick?: ComponentPropsWithRef<"span">["onClick"];
  /** Appends a remove button that calls this. */
  onRemove?: () => void;
  /** Accessible name of the remove button. Defaults to the localized "Remove". */
  removeLabel?: string;
}

const statusTones = new Set<string>(["info", "success", "warning", "danger"]);
const builtinTones = new Set<string>(Object.keys(chipToneClasses));

export function Chip({
  tone = "neutral",
  size = "md",
  square,
  icon,
  statusIcon: withStatusIcon,
  onRemove,
  removeLabel,
  className,
  style,
  children,
  ...props
}: ChipProps) {
  const strings = useUiStrings();
  const custom = isCustomTone(tone, builtinTones);
  const leading =
    icon ??
    (withStatusIcon && statusTones.has(tone) ? statusIcon(tone as StatusTone, "size-3") : null);
  const interactive = props.onClick !== undefined || props.role === "button";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap leading-none [&_svg]:size-3",
        chipSizeClasses[size],
        square ? "rounded-chip" : "rounded-badge",
        custom
          ? "bg-(--tone-c-soft) text-(--tone-c-ink)"
          : (chipToneClasses[tone as ChipBuiltinTone] ?? chipToneClasses.neutral),
        interactive && "min-h-control-sm",
        (interactive || onRemove) && "in-data-[density=touch]:min-h-11",
        onRemove && "pr-1",
        className,
      )}
      style={customToneStyle(tone, builtinTones, style)}
      {...props}
    >
      {leading}
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? strings.remove}
          onClick={onRemove}
          className="grid size-4 shrink-0 cursor-pointer place-items-center self-center rounded-full text-current opacity-70 hover:opacity-100 focus-visible:focus-ring in-data-[density=touch]:size-11 in-data-[density=touch]:-mr-2"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
