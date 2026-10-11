import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export interface Step {
  id: string;
  label: string;
}

export type StepperPart = "root" | "step" | "current" | "marker" | "label" | "connector";

export interface StepperProps extends Omit<ComponentPropsWithRef<"ol">, "children"> {
  steps: Step[];
  currentStepId: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StepperPart>;
}

/** Step 1-N indicator for multi-stage flows. */
export function Stepper({ steps, currentStepId, className, classNames, ...props }: StepperProps) {
  return (
    <ol
      {...props}
      className={cn(
        "@container/stepper flex min-w-0 flex-wrap items-center gap-1.5 text-meta text-ink-3",
        classNames?.root,
        className,
      )}
    >
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStepId;
        return (
          <li key={step.id} className={cn("flex min-w-0 items-center gap-1.5", classNames?.step)}>
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                isCurrent && "text-ink",
                isCurrent && classNames?.current,
              )}
            >
              <span
                className={cn(
                  "grid size-4.5 place-items-center rounded-pill border text-count",
                  isCurrent ? "border-accent-ink text-accent-ink" : "border-line-strong",
                  classNames?.marker,
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate",
                  !isCurrent && "@max-[420px]/stepper:sr-only",
                  isCurrent && "@max-[420px]/stepper:max-w-[40cqw]",
                  classNames?.label,
                )}
              >
                {step.label}
              </span>
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px w-4.5 bg-line-strong @max-[420px]/stepper:w-2.5",
                  classNames?.connector,
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
