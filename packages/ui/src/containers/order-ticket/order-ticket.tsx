"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useId, useSyncExternalStore } from "react";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { ElapsedTime } from "../../atoms/elapsed-time/elapsed-time.js";
import { readElapsed } from "../../atoms/elapsed-time/model.js";
import { getTickerSnapshot, subscribeTicker } from "../../atoms/elapsed-time/ticker.js";
import { Progress, type ProgressBuiltinTone } from "../../atoms/progress/progress.js";
import { type UiStrings, useUiStrings } from "../../i18n/index.js";
import {
  AlarmClock,
  CircleAlert,
  CircleCheck,
  Hourglass,
  Play,
  RotateCcw,
  Square,
  TriangleAlert,
} from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import {
  type OrderTicketLine,
  type OrderTicketLineStatus,
  type OrderTicketState,
  orderTicketState,
} from "./model.js";

export type OrderTicketPart =
  | "root"
  | "paper"
  | "band"
  | "title"
  | "meta"
  | "timer"
  | "progress"
  | "lines"
  | "line"
  | "footer";

export interface OrderTicketChannel {
  label: string;
  icon?: ReactNode;
}

export interface OrderTicketProps
  extends Omit<ComponentPropsWithoutRef<"article">, "title" | "children"> {
  table?: string | undefined;
  number?: string | number | undefined;
  channel?: OrderTicketChannel | undefined;
  guests?: number | undefined;
  server?: string | undefined;
  customer?: string | undefined;
  since: Date | string;
  targetMinutes: number;
  serverOffsetMs?: number | undefined;
  state?: OrderTicketState | undefined;
  lines: readonly OrderTicketLine[];
  partIndex?: number | undefined;
  partCount?: number | undefined;
  recovered?: boolean | undefined;
  chip?: ReactNode;
  readOnly?: boolean | undefined;
  onStartAll?: ((lines: readonly OrderTicketLine[]) => void) | undefined;
  onReadyAll?: ((lines: readonly OrderTicketLine[]) => void) | undefined;
  actions?: ReactNode;
  hanging?: boolean | undefined;
  headingLevel?: 2 | 3 | 4 | undefined;
  viewTransitionName?: string | undefined;
  classNames?: ClassNames<OrderTicketPart> | undefined;
}

const progressTone: Record<OrderTicketState, ProgressBuiltinTone> = {
  ok: "accent",
  warn: "warning",
  late: "danger",
};

const timerTone: Record<OrderTicketState, string> = {
  ok: "font-normal text-ink",
  warn: "font-normal text-warning",
  late: "font-normal text-current",
};

const stateWord: Record<OrderTicketState, keyof UiStrings> = {
  ok: "orderTicketOnTime",
  warn: "orderTicketDueSoon",
  late: "orderTicketLate",
};

const lineStateWord: Record<OrderTicketLineStatus, keyof UiStrings> = {
  pending: "orderTicketPending",
  "in-progress": "orderTicketInProgress",
  done: "orderTicketDone",
};

const lineStateIcon: Record<OrderTicketLineStatus, ReactNode> = {
  pending: <Square size={18} aria-hidden="true" />,
  "in-progress": <Play size={18} aria-hidden="true" />,
  done: <CircleCheck size={18} aria-hidden="true" />,
};

const lineToneClasses: Record<OrderTicketLineStatus, string> = {
  pending: "",
  "in-progress": "bg-accent-soft",
  done: "",
};

const lineStateClasses: Record<OrderTicketLineStatus, string> = {
  pending: "text-ink-2",
  "in-progress": "text-accent-ink",
  done: "text-success",
};

const lineStateTextClasses: Record<OrderTicketLineStatus, string> = {
  pending: "sr-only",
  "in-progress": "sr-only @[340px]/ticket:not-sr-only",
  done: "sr-only @[340px]/ticket:not-sr-only",
};

const pressedOf: Record<OrderTicketLineStatus, boolean | "mixed"> = {
  pending: false,
  "in-progress": "mixed",
  done: true,
};

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const noteClasses =
  "inline-flex max-w-full items-start gap-1 self-start rounded-chip px-1.5 py-0.5 text-meta font-medium [&_svg]:mt-0.5 [&_svg]:shrink-0";

function LineContent({
  line,
  status,
  strings,
}: {
  line: OrderTicketLine;
  status: OrderTicketLineStatus;
  strings: UiStrings;
}) {
  const done = status === "done";
  return (
    <>
      <span
        className={cn(
          "text-right text-card-title tabular-nums",
          done && "text-ink-2 line-through decoration-2",
        )}
      >
        {line.qty}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "text-card-title [overflow-wrap:anywhere]",
            done && "text-ink-2 line-through decoration-2",
          )}
        >
          {line.name}
        </span>
        {line.modifiers && line.modifiers.length > 0 && (
          <span className="text-meta text-ink-2 [overflow-wrap:anywhere]">
            {line.modifiers.join(" · ")}
          </span>
        )}
        {line.note && (
          <span
            data-part="note"
            className={cn(noteClasses, "text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]")}
          >
            <TriangleAlert size={14} aria-hidden="true" />
            {fill(strings.orderTicketNote, { note: line.note })}
          </span>
        )}
        {line.allergy && (
          <span
            data-part="allergy"
            className={cn(
              noteClasses,
              "font-semibold text-danger shadow-[inset_0_0_0_1.5px_var(--danger)]",
            )}
          >
            <CircleAlert size={14} aria-hidden="true" />
            {fill(strings.orderTicketAllergy, { allergy: line.allergy })}
          </span>
        )}
      </span>
      <span
        className={cn(
          "inline-flex min-h-[1.4em] items-center justify-end gap-1.5 text-meta font-semibold",
          lineStateClasses[status],
        )}
      >
        <span className={lineStateTextClasses[status]}>{strings[lineStateWord[status]]}</span>
        {lineStateIcon[status]}
      </span>
    </>
  );
}

function TicketLineRow({
  line,
  readOnly,
  strings,
  className,
}: {
  line: OrderTicketLine;
  readOnly: boolean;
  strings: UiStrings;
  className: string | undefined;
}) {
  const status = line.status ?? "pending";
  const rowClasses = cn(
    "grid min-h-[max(var(--touch-target),2rem)] w-full grid-cols-[2.4ch_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-control px-1.5 py-1 text-left text-ink",
    lineToneClasses[status],
    className,
  );
  const content = <LineContent line={line} status={status} strings={strings} />;
  return (
    <li data-line={line.id} data-status={status}>
      {line.onToggle && !readOnly ? (
        <button
          type="button"
          aria-pressed={pressedOf[status]}
          onClick={line.onToggle}
          className={cn(
            rowClasses,
            "cursor-pointer transition-colors focus-visible:focus-ring motion-reduce:transition-none",
            status !== "in-progress" && "hover:bg-surface-2",
          )}
        >
          {content}
        </button>
      ) : (
        <div className={rowClasses}>{content}</div>
      )}
    </li>
  );
}

export function OrderTicket({
  table,
  number,
  channel,
  guests,
  server,
  customer,
  since,
  targetMinutes,
  serverOffsetMs,
  state: stateProp,
  lines,
  partIndex,
  partCount,
  recovered,
  chip,
  readOnly = false,
  onStartAll,
  onReadyAll,
  actions,
  hanging,
  headingLevel = 3,
  viewTransitionName,
  classNames,
  className,
  style,
  ...props
}: OrderTicketProps) {
  const strings = useUiStrings();
  const reducedMotion = usePrefersReducedMotion();
  const headingId = useId();
  const now = useSyncExternalStore(subscribeTicker, getTickerSnapshot, getTickerSnapshot);
  const { seconds } = readElapsed({ since, now, serverOffsetMs });
  const targetSeconds = Math.max(1, targetMinutes * 60);
  const state = stateProp ?? orderTicketState(seconds, targetMinutes);
  const late = state === "late";
  const overrun = Math.max(0, seconds - targetSeconds);
  const Heading = `h${headingLevel}` as const;
  const title = table ?? fill(strings.orderTicketNumber, { number: number ?? "" });
  const titleIcon = table ? null : channel?.icon;
  const guestsText =
    guests === undefined
      ? undefined
      : fill(guests === 1 ? strings.orderTicketGuestsOne : strings.orderTicketGuests, {
          count: guests,
        });
  const meta = [table ? undefined : channel?.label, guestsText, server, customer]
    .filter(Boolean)
    .join(" · ");
  const split = partCount !== undefined && partCount > 1;
  const partLabel =
    split && (partIndex ?? 1) > 1
      ? strings.orderTicketContinued
      : fill(strings.orderTicketPart, { index: 1, count: partCount ?? 1 });
  const overrunText = reducedMotion
    ? fill(strings.minutesShort, { count: Math.ceil(overrun / 60) })
    : clock(overrun);
  const showActions = !readOnly && Boolean(actions || onStartAll || onReadyAll);

  return (
    <article
      aria-labelledby={headingId}
      data-state={state}
      data-read-only={readOnly ? "" : undefined}
      data-part-index={split ? (partIndex ?? 1) : undefined}
      className={cn(
        "@container/ticket relative min-w-0 [--ticket-edge:var(--hair)] data-[state=late]:[--ticket-edge:var(--danger)]",
        "[filter:drop-shadow(1px_0_0_var(--ticket-edge))_drop-shadow(-1px_0_0_var(--ticket-edge))_drop-shadow(0_1px_0_var(--ticket-edge))_drop-shadow(0_-1px_0_var(--ticket-edge))]",
        hanging &&
          "pt-2.5 before:absolute before:top-0 before:left-1/2 before:z-1 before:h-4 before:w-11 before:-translate-x-1/2 before:rounded-[4px_4px_2px_2px] before:bg-line-strong before:shadow-[inset_0_-3px_0_var(--sunken)] before:content-['']",
        classNames?.root,
        className,
      )}
      style={viewTransitionName ? { ...style, viewTransitionName } : style}
      {...props}
    >
      <div
        data-part="paper"
        className={cn(
          "relative flex flex-col gap-2.5 rounded-t-card bg-surface p-3 pb-[calc(--spacing(3)+6px)] text-ink",
          "[mask:conic-gradient(from_-45deg_at_bottom,transparent,black_1deg_89deg,transparent_90deg)_50%/12px_100%]",
          classNames?.paper,
        )}
      >
        <div
          data-part="band"
          className={cn(
            "-mx-3 -mt-3 flex flex-col gap-1.5 rounded-t-card px-3 pt-3 pb-2.5",
            hanging && "pt-4",
            late && "bg-danger text-surface",
            classNames?.band,
          )}
        >
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <Heading
                id={headingId}
                className={cn(
                  "m-0 inline-flex items-center gap-1.5 text-kpi-number text-balance [overflow-wrap:anywhere] [&_svg]:shrink-0",
                  classNames?.title,
                )}
              >
                {titleIcon}
                <span>{title}</span>
                {split && <span className="text-control">{partLabel}</span>}
                <span className="sr-only">{`, ${strings[stateWord[state]]}`}</span>
              </Heading>
              {meta && (
                <span
                  className={cn(
                    "min-w-0 text-meta",
                    late ? "text-current" : "text-ink-2",
                    classNames?.meta,
                  )}
                >
                  {meta}
                </span>
              )}
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap",
                state === "warn" && "text-warning",
                classNames?.timer,
              )}
            >
              {state === "warn" && <Hourglass size={18} aria-hidden="true" />}
              <ElapsedTime
                since={since}
                {...(serverOffsetMs === undefined ? {} : { serverOffsetMs })}
                className={cn("text-kpi-number", timerTone[state])}
              />
            </span>
          </header>
          {late && (
            <span className="inline-flex items-center gap-1.5 text-row-title">
              <AlarmClock size={18} aria-hidden="true" />
              {fill(strings.orderTicketLateBy, { time: overrunText })}
            </span>
          )}
        </div>
        <Progress
          value={Math.min(seconds, targetSeconds)}
          max={targetSeconds}
          tone={progressTone[state]}
          aria-label={fill(strings.orderTicketProgress, { target: targetMinutes })}
          getValueLabel={() =>
            fill(strings.orderTicketProgressValue, {
              elapsed: Math.floor(seconds / 60),
              target: targetMinutes,
            })
          }
          className={classNames?.progress}
        />
        {recovered && (
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="info" icon={<RotateCcw size={14} aria-hidden="true" />}>
              {strings.orderTicketRecovered}
            </Chip>
          </div>
        )}
        <ul
          aria-label={strings.orderTicketItems}
          className={cn("-mx-1.5 my-0 flex list-none flex-col gap-0.5 p-0", classNames?.lines)}
        >
          {lines.map((line) => (
            <TicketLineRow
              key={line.id}
              line={line}
              readOnly={readOnly}
              strings={strings}
              className={classNames?.line}
            />
          ))}
        </ul>
        {(chip || showActions) && (
          <footer
            className={cn(
              "flex items-center gap-2 border-t border-dashed border-line-strong pt-2.5",
              classNames?.footer,
            )}
          >
            <div className="flex min-w-0 grow flex-wrap gap-1.5 @max-[310px]/ticket:hidden">
              {chip && (
                <Chip tone="neutral" className="min-w-0">
                  {chip}
                </Chip>
              )}
            </div>
            {showActions && actions}
            {showActions && onStartAll && (
              <Button
                variant={onReadyAll ? "secondary" : "primary"}
                className="whitespace-nowrap @max-[310px]/ticket:flex-1"
                onClick={() => onStartAll(lines)}
              >
                {strings.orderTicketStartAll}
              </Button>
            )}
            {showActions && onReadyAll && (
              <Button
                variant="primary"
                className="whitespace-nowrap @max-[310px]/ticket:flex-1"
                onClick={() => onReadyAll(lines)}
              >
                {strings.orderTicketReadyAll}
              </Button>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}
