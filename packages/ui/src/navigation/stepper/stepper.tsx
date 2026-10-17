import type { ComponentPropsWithRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { Check, X } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type StepStatus = "done" | "current" | "error" | "pending";

export interface Step {
  id: string;
  label: string;
  /**
   * Explicit state of the step. Without it the step is `current` when it is `currentStepId` and
   * `pending` otherwise. A `done` step shows a check, an `error` step a cross and both announce
   * their state; neither relies on colour alone. The step named by `currentStepId` keeps
   * `aria-current="step"` whatever its status.
   */
  status?: StepStatus;
}

const markerStatusClasses: Record<StepStatus, string> = {
  pending: "border-line-strong",
  current: "border-accent-ink text-accent-ink",
  done: "border-success bg-success-soft text-success",
  error: "border-danger bg-danger-soft text-danger",
};

export type StepperPart = "root" | "step" | "current" | "marker" | "label" | "connector";

export interface StepperProps extends Omit<ComponentPropsWithRef<"ol">, "children"> {
  steps: Step[];
  currentStepId: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StepperPart>;
}

/** Step 1-N indicator for multi-stage flows. */
export function Stepper({ steps, currentStepId, className, classNames, ...props }: StepperProps) {
  const strings = useUiStrings();
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
        const status: StepStatus = step.status ?? (isCurrent ? "current" : "pending");
        const emphasised = isCurrent || status === "current" || status === "error";
        return (
          <li
            key={step.id}
            data-status={status}
            className={cn("flex min-w-0 items-center gap-1.5", classNames?.step)}
          >
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                emphasised && "text-ink",
                isCurrent && classNames?.current,
              )}
            >
              <span
                className={cn(
                  "grid size-4.5 place-items-center rounded-pill border text-count",
                  markerStatusClasses[status],
                  classNames?.marker,
                )}
              >
                {status === "done" ? (
                  <Check aria-hidden="true" className="size-3" />
                ) : status === "error" ? (
                  <X aria-hidden="true" className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate",
                  !emphasised && "@max-[420px]/stepper:sr-only",
                  isCurrent && "@max-[420px]/stepper:max-w-[40cqw]",
                  classNames?.label,
                )}
              >
                {step.label}
              </span>
              {status === "done" || status === "error" ? (
                <span className="sr-only">
                  , {status === "done" ? strings.stepDone : strings.stepError}
                </span>
              ) : null}
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
