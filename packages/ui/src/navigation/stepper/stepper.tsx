import { cn } from "../../utils/cn.js";

export interface Step {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: Step[];
  currentStepId: string;
  className?: string;
}

/** Step 1-N indicator for multi-stage flows. */
export function Stepper({ steps, currentStepId, className }: StepperProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-1.5 text-meta text-ink-3", className)}>
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStepId;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex items-center gap-1.5", isCurrent && "text-ink")}
            >
              <span
                className={cn(
                  "grid size-4.5 place-items-center rounded-pill border text-count",
                  isCurrent ? "border-accent-ink text-accent-ink" : "border-line-strong",
                )}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="h-px w-4.5 bg-line-strong" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
