import type { ComponentPropsWithRef } from "react";
import { ChevronsUpDown } from "../../icons/index.js";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { cn } from "../../utils/cn.js";

export interface InlineSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineSelectProps
  extends Omit<ComponentPropsWithRef<"select">, "size">,
    IntentProps {
  options: InlineSelectOption[];
}

/**
 * Borderless select that reads as part of a sentence or a row ("Repetir cada [semana v]").
 * Native `<select>` underneath, so the system picker and keyboard behaviour are kept.
 */
export function InlineSelect({
  options,
  className,
  intent,
  intentKey,
  ...props
}: InlineSelectProps) {
  return (
    <span className="relative inline-flex max-w-full items-center rounded-chip hover:bg-surface-sunken has-[:focus-visible]:focus-ring">
      <select
        className={cn(
          "h-control-sm max-w-full cursor-pointer appearance-none truncate rounded-chip bg-transparent py-0 pr-6 pl-2 font-semibold text-control text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...intentAttributes({ intent, intentKey })}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 size-3 text-ink-3"
      />
    </span>
  );
}
