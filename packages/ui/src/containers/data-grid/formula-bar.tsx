"use client";

import { useEffect, useState } from "react";
import { cn } from "../../utils/cn.js";

export interface FormulaBarProps {
  /** Address of the focused cell (`C4`), empty when no data cell has focus. */
  address: string;
  /** Raw content of the cell: the formula text for formula cells. */
  value: string;
  editable: boolean;
  /** Message of the last refused commit. */
  error?: string;
  labels: { bar: string; cell: string; empty: string };
  onCommit: (text: string) => void;
  onDiscard: () => void;
}

/** Shows (and edits) the raw content of the focused cell, so formulas stay readable. */
export function FormulaBar({
  address,
  value,
  editable,
  error,
  labels,
  onCommit,
  onDiscard,
}: FormulaBarProps) {
  const [draft, setDraft] = useState(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new cell or a new content resets the draft.
  useEffect(() => {
    setDraft(value);
  }, [address, value]);

  return (
    <div className="flex min-w-0 items-center gap-2 border-b-divider px-2 py-1.5">
      <span
        title={labels.cell}
        className="grid h-control-sm min-w-12 shrink-0 place-items-center rounded-xs bg-surface-2 px-2 font-[650] text-[12px] text-ink-2 tabular-nums"
      >
        <span className="sr-only">{labels.cell}: </span>
        {address || "—"}
      </span>
      <span aria-hidden="true" className="shrink-0 font-[650] text-[13px] text-accent-ink italic">
        fx
      </span>
      <input
        type="text"
        aria-label={labels.bar}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
        autoComplete="off"
        disabled={address === ""}
        readOnly={!editable}
        value={draft}
        placeholder={address === "" ? labels.empty : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && editable) {
            event.preventDefault();
            onCommit(draft);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            onDiscard();
          }
        }}
        className={cn(
          "h-control-sm min-w-0 flex-1 rounded-input border-control bg-surface-control px-2 font-mono text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none disabled:opacity-60",
          error && "border-danger",
        )}
      />
      {error ? (
        <span role="alert" className="shrink-0 text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
