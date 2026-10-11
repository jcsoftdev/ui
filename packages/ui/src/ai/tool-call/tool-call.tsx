import { useMemo } from "react";
import { Check, CircleAlert, Clock, LoaderCircle, Wrench } from "../../icons/index.js";
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
}: ToolCallProps) {
  const info = STATUS[status];
  const argsText = useMemo(() => (args === undefined ? null : pretty(args)), [args]);
  const resultText = useMemo(() => (result === undefined ? null : pretty(result)), [result]);

  return (
    <div
      className={cn(
        "@container/tool min-w-0 rounded-card bg-surface-card p-2 text-ink border-card shadow-card",
        className,
      )}
    >
      <Disclosure
        defaultOpen={defaultOpen}
        header={
          <>
            <Wrench aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 truncate font-mono text-meta font-medium">{name}</span>
            <span className={cn("ml-auto flex shrink-0 items-center gap-1 text-meta", info.tone)}>
              <StatusIcon status={status} />
              <span className="hidden @xs/tool:inline">{info.label}</span>
              <span className="sr-only @xs/tool:hidden">{info.label}</span>
              {duration ? (
                <span className="hidden text-ink-3 @sm/tool:inline">· {duration}</span>
              ) : null}
            </span>
          </>
        }
        panelClassName="grid gap-density-sm"
      >
        <div className="grid gap-density-sm pt-density-sm">
          {argsText ? (
            <section aria-label="Argumentos" className="grid gap-1">
              <h4 className="text-meta font-semibold text-ink-2">Argumentos</h4>
              <CodeBlock code={argsText} language="json" />
            </section>
          ) : null}
          {status === "error" && error ? (
            <p
              role="alert"
              className="rounded-badge bg-danger-soft px-2 py-1 text-meta text-danger"
            >
              {error}
            </p>
          ) : null}
          {resultText ? (
            <section aria-label="Resultado" className="grid gap-1">
              <h4 className="text-meta font-semibold text-ink-2">Resultado</h4>
              <CodeBlock code={resultText} language="json" />
            </section>
          ) : null}
        </div>
      </Disclosure>
    </div>
  );
}
