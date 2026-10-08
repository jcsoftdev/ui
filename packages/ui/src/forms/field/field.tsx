"use client";

import { cloneElement, isValidElement, type ReactElement, useId } from "react";
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
  error?: string;
  id?: string;
  children: ReactElement<ControlProps>;
  className?: string;
}

export function Field({ label, hint, error, id, children, className }: FieldProps) {
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
      <Label htmlFor={controlId}>{label}</Label>
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
