import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type TimelineFeedTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface TimelineFeedItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Display time, e.g. "Hace 5 min" or "14:30". */
  time?: string;
  /** Machine-readable value for the `<time>` element. */
  dateTime?: string;
  /** Icon inside the marker; without it the marker is a dot. */
  icon?: ReactNode;
  tone?: TimelineFeedTone;
  /** Person or system that did it. */
  actor?: string;
  /** Extra content under the text: attachments, chips, actions. */
  children?: ReactNode;
  /** Items with the same `group` sit under one heading (e.g. "Hoy"). */
  group?: string;
}

export interface TimelineProps extends Omit<ComponentPropsWithoutRef<"ol">, "children"> {
  items: TimelineFeedItem[];
}

const markerClasses: Record<TimelineFeedTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/** Vertical activity feed: marker rail on the left, grouped by day, newest first by convention. */
export function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <div className={cn("@container/timeline min-w-0", className)}>
      <ol className="m-0 flex list-none flex-col p-0" {...props}>
        {items.map((item, index) => {
          const previous = items[index - 1];
          const last = index === items.length - 1;
          const tone = item.tone ?? "neutral";
          return (
            <li key={item.id} className="flex min-w-0 flex-col">
              {item.group && item.group !== previous?.group ? (
                <h4 className="pb-density-sm text-ink-3 text-overline uppercase">{item.group}</h4>
              ) : null}
              <div className="flex min-w-0 gap-density">
                <div className="flex shrink-0 flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-badge [&_svg]:size-3.5",
                      markerClasses[tone],
                    )}
                  >
                    {item.icon ?? <span className="size-2 rounded-full bg-current" />}
                  </span>
                  {last ? null : <span aria-hidden="true" className="w-px flex-1 bg-divider" />}
                </div>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1",
                    last ? "pb-0" : "pb-density-lg",
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-density-sm">
                    <span className="min-w-0 break-words text-row-title text-ink">
                      {item.title}
                    </span>
                    {item.time ? (
                      <time dateTime={item.dateTime} className="shrink-0 text-ink-3 text-meta">
                        {item.time}
                      </time>
                    ) : null}
                  </div>
                  {item.actor ? <span className="text-ink-3 text-meta">{item.actor}</span> : null}
                  {item.description ? (
                    <p className="m-0 break-words text-body text-ink-2">{item.description}</p>
                  ) : null}
                  {item.children}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
