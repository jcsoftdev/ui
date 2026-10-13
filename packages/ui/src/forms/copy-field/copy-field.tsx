"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from "react";
import { Button } from "../../atoms/button/index.js";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { copyText } from "./copy.js";

export type CopyFieldPart = "root" | "label" | "value" | "button";

export interface CopyFieldProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onCopy"> {
  label: string;
  /** Text shown and copied. */
  value: string;
  /** Replaces the localized button text. */
  copyLabel?: string;
  /** Replaces the localized text shown and announced after a successful copy. */
  copiedLabel?: string;
  /** Milliseconds the "copied" state lasts. Defaults to 1500. */
  resetDelay?: number;
  /** Called with the value after it was copied. */
  onCopy?: (value: string) => void;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<CopyFieldPart>;
}

/**
 * Read-only value with a button that copies it. After a copy the button text changes and a polite
 * `role="status"` region announces it; if the clipboard refuses, nothing changes.
 */
export function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
  resetDelay = 1500,
  onCopy,
  className,
  classNames,
  ...props
}: CopyFieldProps) {
  const strings = useUiStrings();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = copyLabel ?? strings.copy;
  const done = copiedLabel ?? strings.copied;
  const text = copied ? done : copy;

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  async function onClick() {
    const ok = await copyText(value);
    if (timer.current !== null) clearTimeout(timer.current);
    setCopied(ok);
    if (!ok) return;
    onCopy?.(value);
    timer.current = setTimeout(() => setCopied(false), resetDelay);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-surface-2 px-4 py-3",
        classNames?.root,
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
        <span className={cn("text-ink-3 text-meta", classNames?.label)}>{label}</span>
        <p
          className={cn(
            "m-0 font-mono text-ink text-control [overflow-wrap:anywhere]",
            classNames?.value,
          )}
        >
          {value}
        </p>
      </div>
      <Button
        variant="secondary"
        aria-label={`${text}: ${label}`}
        className={cn("shrink-0", classNames?.button)}
        onClick={onClick}
      >
        {text}
      </Button>
      <span role="status" className="sr-only">
        {copied ? done : null}
      </span>
    </div>
  );
}
