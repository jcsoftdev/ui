"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import { Check, X } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type TimelineFeedTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Where an item stands in a process: finished, in progress, failed or not reached yet. */
export type TimelineStatus = "done" | "current" | "error" | "pending";

export interface TimelineFeedItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Display time, e.g. "Hace 5 min" or "14:30". */
  time?: string;
  /** Machine-readable value for the `<time>` element. */
  dateTime?: string;
  /** Icon inside the marker; without it the marker is a dot (a check or cross for `done` and `error`). */
  icon?: ReactNode;
  /** Marker colour. Without it the tone follows `status`, or is neutral. */
  tone?: TimelineFeedTone;
  /**
   * Process state. `done` and `error` get a check or cross and a spoken state, `current` sets
   * `aria-current="step"` and rings the marker, `pending` dims the item. Independent of `tone`.
   */
  status?: TimelineStatus;
  /** Person or system that did it. */
  actor?: string;
  /** Extra content under the text: attachments, chips, actions. */
  children?: ReactNode;
  /** Items with the same `group` sit under one heading (e.g. "Hoy"). */
  group?: string;
}

export type TimelinePart =
  | "root"
  | "list"
  | "item"
  | "group"
  | "rail"
  | "marker"
  | "connector"
  | "content"
  | "header"
  | "title"
  | "time"
  | "actor"
  | "description";

export interface TimelineProps extends Omit<ComponentPropsWithoutRef<"ol">, "children"> {
  /** Data-driven entries. Rendered before `children`. */
  items?: TimelineFeedItem[];
  /**
   * Composed entries: `Timeline.Item` (or your own component that renders one) as children.
   * A wrapper keeps its position, but only an element whose props carry `group` can open a group heading.
   */
  children?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<TimelinePart>;
}

const markerClasses: Record<TimelineFeedTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

const statusTone: Record<TimelineStatus, TimelineFeedTone> = {
  done: "success",
  current: "accent",
  error: "danger",
  pending: "neutral",
};

interface TimelinePosition {
  last: boolean;
  showGroup: boolean;
}

const TimelineClasses = createContext<ClassNames<TimelinePart> | undefined>(undefined);
const TimelinePositionContext = createContext<TimelinePosition>({ last: true, showGroup: true });

export interface TimelineItemProps
  extends Omit<TimelineFeedItem, "id">,
    Omit<ComponentPropsWithoutRef<"li">, "title" | "children"> {
  /** Kept so a `TimelineFeedItem` can be spread as is; React uses it as the key. */
  id?: string;
}

/** One entry of a composed `Timeline`. Extra content goes in `children`. */
export function TimelineItem({
  title,
  description,
  time,
  dateTime,
  icon,
  tone,
  status,
  actor,
  group,
  children,
  className,
  ...props
}: TimelineItemProps) {
  const classNames = useContext(TimelineClasses);
  const { last, showGroup } = useContext(TimelinePositionContext);
  const strings = useUiStrings();
  const resolvedTone = tone ?? (status ? statusTone[status] : "neutral");
  const glyph =
    icon ??
    (status === "done" ? (
      <Check />
    ) : status === "error" ? (
      <X />
    ) : status === "pending" ? null : (
      <span className="size-2 rounded-full bg-current" />
    ));
  const stateText =
    status === "done" ? strings.stepDone : status === "error" ? strings.stepError : null;
  return (
    <li
      aria-current={status === "current" ? "step" : undefined}
      data-status={status}
      {...props}
      className={cn("flex min-w-0 flex-col", classNames?.item, className)}
    >
      {group && showGroup ? (
        <h4 className={cn("pb-density-sm text-ink-3 text-overline uppercase", classNames?.group)}>
          {group}
        </h4>
      ) : null}
      <div className="flex min-w-0 gap-density">
        <div className={cn("flex shrink-0 flex-col items-center", classNames?.rail)}>
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-badge [&_svg]:size-3.5",
              markerClasses[resolvedTone],
              status === "current" && "ring-2 ring-accent/40",
              status === "pending" && "border border-line-strong border-dashed bg-transparent",
              classNames?.marker,
            )}
          >
            {glyph ?? <span className="size-1.5 rounded-full bg-current opacity-40" />}
          </span>
          {last ? null : (
            <span
              aria-hidden="true"
              className={cn(
                "w-px flex-1",
                status === "done" ? "bg-success/50" : "bg-divider",
                classNames?.connector,
              )}
            />
          )}
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1",
            last ? "pb-0" : "pb-density-lg",
            status === "pending" && "text-ink-3",
            classNames?.content,
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-wrap items-baseline gap-x-density-sm",
              classNames?.header,
            )}
          >
            <span
              className={cn(
                "min-w-0 break-words text-row-title",
                status === "pending" ? "text-ink-3" : "text-ink",
                classNames?.title,
              )}
            >
              {title}
              {stateText ? <span className="sr-only">, {stateText}</span> : null}
            </span>
            {time ? (
              <time
                dateTime={dateTime}
                className={cn("shrink-0 text-ink-3 text-meta", classNames?.time)}
              >
                {time}
              </time>
            ) : null}
          </div>
          {actor ? (
            <span className={cn("text-ink-3 text-meta", classNames?.actor)}>{actor}</span>
          ) : null}
          {description ? (
            <p className={cn("m-0 break-words text-body text-ink-2", classNames?.description)}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </li>
  );
}

function groupOf(node: ReactNode): string | undefined {
  if (!isValidElement<{ group?: unknown }>(node)) return undefined;
  const group = node.props.group;
  return typeof group === "string" ? group : undefined;
}

/**
 * Vertical activity feed: marker rail on the left, grouped by day, newest first by convention.
 * Pass `items`, or compose `Timeline.Item` children (or both: items come first). Items can carry
 * a `status` (done, current, error, pending) for a process rather than a log.
 */
export function Timeline({ items = [], children, className, classNames, ...props }: TimelineProps) {
  const entries: ReactElement[] = [
    ...items.map(({ id, ...item }) => <TimelineItem key={id} {...item} />),
    ...Children.toArray(children).filter(isValidElement),
  ];
  return (
    <div className={cn("@container/timeline min-w-0", classNames?.root, className)}>
      <TimelineClasses.Provider value={classNames}>
        <ol {...props} className={cn("m-0 flex list-none flex-col p-0", classNames?.list)}>
          {entries.map((entry, index) => {
            const group = groupOf(entry);
            const previous = groupOf(entries[index - 1]);
            return (
              <TimelinePositionContext.Provider
                key={entry.key ?? index}
                value={{
                  last: index === entries.length - 1,
                  showGroup: group !== undefined && group !== previous,
                }}
              >
                {entry}
              </TimelinePositionContext.Provider>
            );
          })}
        </ol>
      </TimelineClasses.Provider>
    </div>
  );
}

Timeline.Item = TimelineItem;
