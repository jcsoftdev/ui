import { Brain, Check } from "lucide-react";
import type { ReactNode } from "react";
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
}: ChainOfThoughtProps) {
  const active = steps.some((step) => step.status === "active");
  return (
    <div
      className={cn(
        "@container/thought min-w-0 rounded-card bg-surface-sunken p-2 text-ink",
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
              <TextShimmer className="truncate text-meta font-medium">{title}…</TextShimmer>
            ) : (
              <span className="truncate text-meta font-medium text-ink-2">{title}</span>
            )}
            {duration ? (
              <span className="ml-auto shrink-0 text-meta text-ink-3">{duration}</span>
            ) : null}
          </>
        }
      >
        <ol className="grid gap-0 pt-density-sm">
          {steps.map((step, index) => {
            const status = step.status ?? "done";
            const last = index === steps.length - 1;
            return (
              <li key={step.id} className="relative flex gap-density-sm pb-density last:pb-0">
                {last ? null : (
                  <span aria-hidden className="absolute bottom-0 left-[9px] top-5 w-px bg-line" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full",
                    status === "done" && "bg-success-soft text-success",
                    status === "active" && "bg-accent-soft text-accent-ink",
                    status === "pending" && "bg-surface-2 text-ink-3",
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
                <div className="grid min-w-0 flex-1 gap-0.5">
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
                    <div className="break-words text-meta text-ink-2">{step.detail}</div>
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
