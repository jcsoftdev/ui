"use client";

import {
  type ComponentPropsWithoutRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  useId,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { Label } from "../label/index.js";

interface ControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export type FieldPart = "root" | "label" | "optional" | "hint" | "error";

export interface FieldProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "id"> {
  label: string;
  hint?: string;
  /** Message under the control; `null` and `undefined` mean no error. */
  error?: string | null;
  /** Marks the field as optional by appending the localized marker to the label. */
  optional?: boolean;
  id?: string;
  children: ReactElement<ControlProps>;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<FieldPart>;
}

export function Field({
  label,
  hint,
  error,
  optional,
  id,
  children,
  className,
  classNames,
  ...props
}: FieldProps) {
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
    <div {...props} className={cn("flex min-w-0 flex-col gap-1.25", className, classNames?.root)}>
      <Label htmlFor={controlId} className={classNames?.label}>
        {label}
        {optional ? (
          <span className={cn("font-normal text-ink-3", classNames?.optional)}>
            {" "}
            ({strings.optional})
          </span>
        ) : null}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className={cn("text-meta text-ink-3", classNames?.hint)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className={cn("font-semibold text-danger text-meta", classNames?.error)}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
