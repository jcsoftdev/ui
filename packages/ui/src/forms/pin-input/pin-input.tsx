"use client";

import { type ChangeEvent, useId, useState } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type PinInputPart = "root" | "dots" | "dot" | "input";

export interface PinInputProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name of the input. */
  label?: string;
  /** Builds the polite live-region announcement. */
  statusLabel?: (entered: number, length: number) => string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<PinInputPart>;
}

const defaultStatusLabel = (entered: number, length: number) =>
  `${entered} of ${length} digits entered`;

/**
 * Masked numeric PIN. `autocomplete` is disabled on purpose so browsers do not
 * mistake it for a one-time code.
 */
export function PinInput({
  length = 4,
  value,
  defaultValue = "",
  onValueChange,
  label = "PIN",
  statusLabel = defaultStatusLabel,
  className,
  classNames,
}: PinInputProps) {
  const statusId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, length);
    if (value === undefined) setInternal(digits);
    onValueChange?.(digits);
  }

  return (
    <div
      className={cn(
        "@container/pin flex min-w-0 flex-col items-center gap-3",
        classNames?.root,
        className,
      )}
    >
      <div
        className={cn(
          "flex max-w-full flex-wrap justify-center gap-2 @min-[240px]/pin:gap-3",
          classNames?.dots,
        )}
        aria-hidden="true"
      >
        {Array.from({ length }, (_, index) => (
          <i
            key={`digit-${
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed PIN positions
              index
            }`}
            className={cn(
              "size-3 shrink-0 rounded-pill border-2 border-line-control @min-[240px]/pin:size-3.5",
              index < current.length && "border-ink bg-ink",
              classNames?.dot,
            )}
          />
        ))}
      </div>
      <input
        className={cn(
          "h-input w-full min-w-0 rounded-input border-control bg-surface-control px-2 text-center font-mono text-control text-ink tracking-[0.15em] @min-[240px]/pin:px-3 @min-[240px]/pin:tracking-[0.3em] focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1",
          classNames?.input,
        )}
        type="password"
        inputMode="numeric"
        maxLength={length}
        autoComplete="off"
        aria-label={label}
        aria-describedby={statusId}
        value={current}
        onChange={handleChange}
      />
      <span id={statusId} className="sr-only" aria-live="polite">
        {statusLabel(current.length, length)}
      </span>
    </div>
  );
}
