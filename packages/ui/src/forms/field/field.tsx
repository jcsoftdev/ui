"use client";

import {
  type ComponentPropsWithoutRef,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
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

const FORM_TAGS = new Set(["input", "select", "textarea", "button"]);
const CONTROL =
  'input:not([type="hidden"]):not([disabled]), select, textarea, [role="combobox"], [role="spinbutton"], [role="slider"], [contenteditable="true"]';
const FALLBACK_CONTROL = 'button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

export type FieldPart = "root" | "label" | "optional" | "hint" | "error";

export interface FieldProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "id"> {
  /** The label content: text or any node (an icon, a tooltip trigger). */
  label: ReactNode;
  hint?: string;
  /** Message under the control; `null` and `undefined` mean no error. */
  error?: string | null;
  /** Marks the field as optional by appending the localized marker to the label. */
  optional?: boolean;
  /** Id of the control the label and messages belong to. Generated when omitted. */
  id?: string;
  /**
   * Same as `id`, for fields with several children: the control carrying this id gets the
   * description and invalid wiring and is what the label points at. Without it the first input,
   * select, textarea or ARIA widget inside the field is used.
   */
  controlId?: string;
  /**
   * One control element (a component, or input, select, textarea) receives `id`, `aria-describedby` and `aria-invalid` directly. Several
   * children (or a fragment, a plain wrapper element, or text) are rendered as given and the first control is wired after mount.
   */
  children: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<FieldPart>;
}

export function Field({
  label,
  hint,
  error,
  optional,
  id: idProp,
  controlId: controlIdProp,
  children,
  className,
  classNames,
  ...props
}: FieldProps) {
  const strings = useUiStrings();
  const generatedId = useId();
  const baseId = controlIdProp ?? idProp ?? generatedId;
  const [adoptedId, setAdoptedId] = useState<string | null>(null);
  const controlId = adoptedId ?? baseId;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const single =
    isValidElement<ControlProps>(children) &&
    children.type !== Fragment &&
    (typeof children.type !== "string" || FORM_TAGS.has(children.type));
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = single
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  // Several children: wire the target control the way `cloneElement` does for a single one.
  useEffect(() => {
    const body = bodyRef.current;
    if (single || !body) return;
    const target =
      (controlIdProp || idProp ? document.getElementById(baseId) : null) ??
      body.querySelector<HTMLElement>(CONTROL) ??
      body.querySelector<HTMLElement>(FALLBACK_CONTROL);
    if (!target || !body.contains(target)) return;
    if (!target.id) target.id = baseId;
    setAdoptedId(target.id);
    const before = {
      describedby: target.getAttribute("aria-describedby"),
      invalid: target.getAttribute("aria-invalid"),
    };
    const merged = [before.describedby, describedBy].filter(Boolean).join(" ");
    if (merged) target.setAttribute("aria-describedby", merged);
    if (error) target.setAttribute("aria-invalid", "true");
    return () => {
      for (const [name, value] of [
        ["aria-describedby", before.describedby],
        ["aria-invalid", before.invalid],
      ] as const) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
  }, [single, baseId, controlIdProp, idProp, describedBy, error]);

  return (
    <div {...props} className={cn("flex min-w-0 flex-col gap-1.25", classNames?.root, className)}>
      <Label htmlFor={controlId} className={classNames?.label}>
        {label}
        {optional ? (
          <span className={cn("font-normal text-ink-3", classNames?.optional)}>
            {" "}
            ({strings.optional})
          </span>
        ) : null}
      </Label>
      {single ? (
        control
      ) : (
        <div ref={bodyRef} className="contents">
          {control}
        </div>
      )}
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
