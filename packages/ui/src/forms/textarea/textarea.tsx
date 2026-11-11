import type { ComponentPropsWithRef } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { cn } from "../../utils/cn.js";

export interface TextareaProps extends ComponentPropsWithRef<"textarea">, IntentProps {}

export function Textarea({ className, intent, intentKey, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-21 w-full min-w-0 resize-y rounded-input border-control bg-surface-control px-3 py-2 text-control text-ink leading-normal placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
    />
  );
}
