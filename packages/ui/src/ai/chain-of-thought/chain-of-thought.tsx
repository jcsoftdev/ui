import type { ReactNode } from "react";
import { Brain, Check } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { Disclosure } from "../internal/disclosure.js";
import { TextShimmer } from "../text-shimmer/text-shimmer.js";

export type ThoughtStatus = "pending" | "active" | "done";

export interface ThoughtStep {
  id: string;
  label: string;
  detail?: ReactNode;
  status?: ThoughtStatus;
}

export type ChainOfThoughtPart =
  | "root"
  | "title"
  | "duration"
  | "list"
  | "step"
  | "rail"
  | "marker"
  | "label"
  | "detail";

export interface ChainOfThoughtProps {
  steps: ThoughtStep[];
  /** Header text; while any step is `active` it shimmers. */
  title?: string;
  /** Pre-formatted total time shown in the header, e.g. `4 s`. */
  duration?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ChainOfThoughtPart>;
}

/** Collapsible list of reasoning steps with a status rail. */
export function ChainOfThought({
  steps,
  title = "Razonamiento",
  duration,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  classNames,
}: ChainOfThoughtProps) {
  const active = steps.some((step) => step.status === "active");
  return (
    <div
      className={cn(
        "@container/thought min-w-0 rounded-card bg-surface-sunken p-2 text-ink",
        classNames?.root,
        className,
      )}
    >
      <Disclosure
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        header={
          <>
            <Brain aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            {active ? (
              <TextShimmer className={cn("truncate text-meta font-medium", classNames?.title)}>
                {title}…
              </TextShimmer>
            ) : (
              <span className={cn("truncate text-meta font-medium text-ink-2", classNames?.title)}>
                {title}
              </span>
            )}
            {duration ? (
              <span className={cn("ml-auto shrink-0 text-meta text-ink-3", classNames?.duration)}>
                {duration}
              </span>
            ) : null}
          </>
        }
      >
        <ol className={cn("grid gap-0 pt-density-sm", classNames?.list)}>
          {steps.map((step, index) => {
            const status = step.status ?? "done";
            const last = index === steps.length - 1;
            return (
              <li
                key={step.id}
                className={cn(
                  "relative flex gap-density-sm pb-density last:pb-0",
                  classNames?.step,
                )}
              >
                {last ? null : (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-0 left-2.25 top-5 w-px bg-line",
                      classNames?.rail,
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-0.5 grid size-4.75 shrink-0 place-items-center rounded-full",
                    status === "done" && "bg-success-soft text-success",
                    status === "active" && "bg-accent-soft text-accent-ink",
                    status === "pending" && "bg-surface-2 text-ink-3",
                    classNames?.marker,
                  )}
                >
                  {status === "done" ? (
                    <Check className="size-3" />
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 rounded-full bg-current",
                        status === "active" && "animate-pulse",
                      )}
                    />
                  )}
                </span>
                <div className={cn("grid min-w-0 flex-1 gap-0.5", classNames?.label)}>
                  <p
                    className={cn(
                      "break-words text-meta font-medium",
                      status === "pending" ? "text-ink-3" : "text-ink",
                    )}
                  >
                    <span className="sr-only">
                      {status === "done"
                        ? "Completado: "
                        : status === "active"
                          ? "En curso: "
                          : "Pendiente: "}
                    </span>
                    {step.label}
                  </p>
                  {step.detail ? (
                    <div className={cn("break-words text-meta text-ink-2", classNames?.detail)}>
                      {step.detail}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Disclosure>
    </div>
  );
}
