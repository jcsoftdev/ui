import { ChevronsUpDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface InlineSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineSelectProps extends Omit<ComponentPropsWithoutRef<"select">, "size"> {
  options: InlineSelectOption[];
}

/**
 * Borderless select that reads as part of a sentence or a row ("Repetir cada [semana v]").
 * Native `<select>` underneath, so the system picker and keyboard behaviour are kept.
 */
export function InlineSelect({ options, className, ...props }: InlineSelectProps) {
  return (
    <span className="relative inline-flex max-w-full items-center rounded-chip hover:bg-surface-sunken has-[:focus-visible]:focus-ring">
      <select
        className={cn(
          "h-control-sm max-w-full cursor-pointer appearance-none truncate rounded-chip bg-transparent py-0 pr-6 pl-2 font-semibold text-control text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
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
