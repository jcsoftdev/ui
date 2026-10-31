"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { Check, Copy } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useCopy } from "../../utils/use-copy.js";

export type CopyFieldPart = "root" | "label" | "box" | "value" | "button";

export interface CopyFieldProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
  label: ReactNode;
  /** Text shown in monospace and written to the clipboard. */
  value: string;
  /** Called after the value was copied. */
  onCopy?: (value: string) => void;
  /** Accessible name of the button; defaults to the UI string `copy`. */
  copyLabel?: string;
  /** Announced and shown on the button after copying; defaults to the UI string `copied`. */
  copiedLabel?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<CopyFieldPart>;
}

export function CopyField({
  label,
  value,
  onCopy,
  copyLabel,
  copiedLabel,
  className,
  classNames,
  ...props
}: CopyFieldProps) {
  const strings = useUiStrings();
  const id = useId();
  const { copied, copy } = useCopy(1500);
  const buttonLabel = copied ? (copiedLabel ?? strings.copied) : (copyLabel ?? strings.copy);

  return (
    <div {...props} className={cn("flex min-w-0 flex-col gap-1.5", classNames?.root, className)}>
      <label htmlFor={id} className={cn("font-semibold text-ink-2 text-meta", classNames?.label)}>
        {label}
      </label>
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-input border-control bg-surface-control pr-1 pl-3",
          classNames?.box,
        )}
      >
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-input min-w-0 flex-1 truncate bg-transparent font-mono text-control text-ink focus:outline-none",
            classNames?.value,
          )}
        />
        <button
          type="button"
          onClick={() => {
            void copy(value);
            onCopy?.(value);
          }}
          className={cn(
            "inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 rounded-button px-2.5 font-semibold text-ink-2 text-meta hover:bg-surface-2 hover:text-ink focus-visible:focus-ring",
            copied && "text-success",
            classNames?.button,
          )}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          <span>{buttonLabel}</span>
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? (copiedLabel ?? strings.copied) : null}
      </span>
    </div>
  );
}
