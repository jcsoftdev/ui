import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface FieldsetProps extends Omit<ComponentPropsWithoutRef<"fieldset">, "title"> {
  /** The group name; announced with each control inside. */
  legend: ReactNode;
  description?: ReactNode;
}

/**
 * Native `<fieldset>` for a group of related controls (a radio set, an address). `disabled`
 * disables every control inside, as the platform does.
 */
export function Fieldset({ legend, description, children, className, ...props }: FieldsetProps) {
  return (
    <fieldset {...props} className={cn("m-0 flex min-w-0 flex-col gap-3 border-0 p-0", className)}>
      <legend className="float-left w-full p-0 font-semibold text-ink-2 text-meta">{legend}</legend>
      {description ? <p className="-mt-1.5 text-meta text-ink-3">{description}</p> : null}
      {children}
    </fieldset>
  );
}
