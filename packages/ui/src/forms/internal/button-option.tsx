import type { ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type ButtonOptionPart = "option" | "icon" | "text" | "label" | "description";

export interface ButtonOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export const optionGridClass =
  "grid gap-density-sm [grid-template-columns:repeat(auto-fill,minmax(min(9.5rem,100%),1fr))]";

interface OptionShellProps {
  option: ButtonOption;
  /** Visually hidden native input: gives focus, keyboard and form semantics for free. */
  input: ReactNode;
  className?: string;
  classNames?: ClassNames<ButtonOptionPart>;
}

/** Selectable card-button around a native checkbox/radio; `peer` styling reads its checked state. */
export function OptionShell({ option, input, className, classNames }: OptionShellProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the native input is passed in through `input` and rendered inside this label
    <label
      className={cn(
        "pressable relative flex min-w-0 cursor-pointer items-center gap-2 rounded-button border-control bg-surface-control px-control-x py-2 text-control text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-selected has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:focus-ring",
        className,
        classNames?.option,
      )}
    >
      {input}
      {option.icon ? (
        <span
          aria-hidden="true"
          className={cn("shrink-0 text-ink-2 [&_svg]:size-4", classNames?.icon)}
        >
          {option.icon}
        </span>
      ) : null}
      <span className={cn("flex min-w-0 flex-col [overflow-wrap:anywhere]", classNames?.text)}>
        <span className={cn("font-semibold", classNames?.label)}>{option.label}</span>
        {option.description ? (
          <span className={cn("text-ink-3 text-meta", classNames?.description)}>
            {option.description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
