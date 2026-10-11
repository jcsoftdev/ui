"use client";

import { cloneElement, isValidElement, type ReactElement, useId } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";
import { Label } from "../label/index.js";

interface ControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface FieldProps {
  label: string;
  hint?: string;
  /** Message under the control; `null` and `undefined` mean no error. */
  error?: string | null;
  /** Marks the field as optional by appending the localized marker to the label. */
  optional?: boolean;
  id?: string;
  children: ReactElement<ControlProps>;
  className?: string;
}

export function Field({ label, hint, error, optional, id, children, className }: FieldProps) {
  const strings = useUiStrings();
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.25", className)}>
      <Label htmlFor={controlId}>
        {label}
        {optional ? <span className="font-normal text-ink-3"> ({strings.optional})</span> : null}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-meta text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="font-semibold text-danger text-meta" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
