import { useMemo } from "react";
import { Check, CircleAlert, Clock, LoaderCircle, Wrench } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { CodeBlock } from "../code-block/code-block.js";
import { Disclosure } from "../internal/disclosure.js";

export type ToolCallStatus = "pending" | "running" | "done" | "error";

const STATUS: Record<ToolCallStatus, { label: string; tone: string }> = {
  pending: { label: "En espera", tone: "text-ink-3" },
  running: { label: "Ejecutando", tone: "text-accent-ink" },
  done: { label: "Listo", tone: "text-success" },
  error: { label: "Error", tone: "text-danger" },
};

function StatusIcon({ status }: { status: ToolCallStatus }) {
  const cls = "size-3.5 shrink-0";
  if (status === "running") return <LoaderCircle aria-hidden className={cn(cls, "animate-spin")} />;
  if (status === "done") return <Check aria-hidden className={cls} />;
  if (status === "error") return <CircleAlert aria-hidden className={cls} />;
  return <Clock aria-hidden className={cls} />;
}

export type ToolCallPart =
  | "root"
  | "header"
  | "body"
  | "name"
  | "status"
  | "panel"
  | "section"
  | "sectionTitle"
  | "code"
  | "error";

export interface ToolCallProps {
  /** Tool identifier, e.g. `buscar_turnos`. */
  name: string;
  status?: ToolCallStatus;
  /** Arguments sent to the tool; shown as formatted JSON. */
  args?: unknown;
  /** Result returned by the tool; shown as formatted JSON. */
  result?: unknown;
  /** Error text when `status` is `error`. */
  error?: string;
  /** Pre-formatted duration, e.g. `1,2 s`. */
  duration?: string;
  defaultOpen?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ToolCallPart>;
}

const pretty = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

/** Collapsible tool invocation with status, JSON arguments and JSON result. */
export function ToolCall({
  name,
  status = "pending",
  args,
  result,
  error,
  duration,
  defaultOpen = false,
  className,
  classNames,
}: ToolCallProps) {
  const info = STATUS[status];
  const argsText = useMemo(() => (args === undefined ? null : pretty(args)), [args]);
  const resultText = useMemo(() => (result === undefined ? null : pretty(result)), [result]);

  return (
    <div
      className={cn(
        "@container/tool min-w-0 rounded-card bg-surface-card p-2 text-ink border-card shadow-card",
        classNames?.root,
        className,
      )}
    >
      <Disclosure
        defaultOpen={defaultOpen}
        triggerClassName={classNames?.header}
        header={
          <>
            <Wrench aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            <span
              className={cn("min-w-0 truncate font-mono text-meta font-medium", classNames?.name)}
            >
              {name}
            </span>
            <span
              className={cn(
                "ml-auto flex shrink-0 items-center gap-1 text-meta",
                info.tone,
                classNames?.status,
              )}
            >
              <StatusIcon status={status} />
              <span className="hidden @xs/tool:inline">{info.label}</span>
              <span className="sr-only @xs/tool:hidden">{info.label}</span>
              {duration ? (
                <span className="hidden text-ink-3 @sm/tool:inline">· {duration}</span>
              ) : null}
            </span>
          </>
        }
        panelClassName={cn("grid gap-density-sm", classNames?.panel)}
      >
        <div className={cn("grid gap-density-sm pt-density-sm", classNames?.body)}>
          {argsText ? (
            <section aria-label="Argumentos" className={cn("grid gap-1", classNames?.section)}>
              <h4 className={cn("text-meta font-semibold text-ink-2", classNames?.sectionTitle)}>
                Argumentos
              </h4>
              <CodeBlock code={argsText} language="json" className={classNames?.code} />
            </section>
          ) : null}
          {status === "error" && error ? (
            <p
              role="alert"
              className={cn(
                "rounded-badge bg-danger-soft px-2 py-1 text-meta text-danger",
                classNames?.error,
              )}
            >
              {error}
            </p>
          ) : null}
          {resultText ? (
            <section aria-label="Resultado" className={cn("grid gap-1", classNames?.section)}>
              <h4 className={cn("text-meta font-semibold text-ink-2", classNames?.sectionTitle)}>
                Resultado
              </h4>
              <CodeBlock code={resultText} language="json" className={classNames?.code} />
            </section>
          ) : null}
        </div>
      </Disclosure>
    </div>
  );
}
