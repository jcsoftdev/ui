import type { ComponentPropsWithRef, ReactNode } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { cn } from "../../utils/cn.js";

export interface FormProps extends ComponentPropsWithRef<"form">, IntentProps {}

/** Vertical form layout; every `<form>` attribute and handler passes through. */
export function Form({ className, intent, intentKey, ...props }: FormProps) {
  return (
    <form
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...intentAttributes({ intent, intentKey })}
      {...props}
    />
  );
}

interface FormMessageProps extends Omit<ComponentPropsWithRef<"p">, "role" | "children"> {
  /** Message text; `null`, `undefined` and an empty string render nothing. */
  message: ReactNode | null | undefined;
}

function hasMessage(message: ReactNode): boolean {
  return message !== null && message !== undefined && message !== false && message !== "";
}

export type FormErrorProps = FormMessageProps;

/** Submit-level error. `role="alert"`, so assistive tech announces it as soon as it appears. */
export function FormError({ message, className, ...props }: FormErrorProps) {
  if (!hasMessage(message)) return null;
  return (
    <p role="alert" className={cn("m-0 font-semibold text-danger text-meta", className)} {...props}>
      {message}
    </p>
  );
}

export type FormStatusProps = FormMessageProps;

/** Submit-level confirmation. `role="status"`, a polite live region that does not interrupt. */
export function FormStatus({ message, className, ...props }: FormStatusProps) {
  if (!hasMessage(message)) return null;
  return (
    <p
      role="status"
      className={cn("m-0 font-semibold text-meta text-success", className)}
      {...props}
    >
      {message}
    </p>
  );
}
