"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "../../atoms/button/button.js";
import { useUiStrings } from "../../i18n/index.js";
import { Check, CheckCheck } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type ChatTimestamp, dayKey, formatDay, formatTime, withDayBreaks } from "./format.js";

export type ChatAuthorKind = "customer" | "bot" | "staff";
export type ChatDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface ChatThreadMessage {
  id: string;
  kind?: "message";
  /** Who wrote it: the customer (incoming), the bot or a staff member (outgoing). */
  author: ChatAuthorKind;
  /** Name shown above the bubble. Defaults to the localized author kind. */
  name?: string;
  at: ChatTimestamp;
  content: ReactNode;
  /** Delivery state, shown under outgoing messages only. Omit it to show none. */
  status?: ChatDeliveryStatus;
}

/** A line in the middle of the thread that is not a message, e.g. "The customer asked for a person". */
export interface ChatThreadNote {
  id: string;
  kind: "note";
  at: ChatTimestamp;
  content: ReactNode;
}

export type ChatThreadItem = ChatThreadMessage | ChatThreadNote;

export interface ChatThreadLabels {
  conversation: string;
  today: string;
  yesterday: string;
  customer: string;
  bot: string;
  staff: string;
  sending: string;
  sent: string;
  delivered: string;
  read: string;
  notSent: string;
}

/** Ready-made labels; the thread defaults to `en`. Pass `chatThreadLabels.es` for Spanish. */
export const chatThreadLabels = {
  en: {
    conversation: "Conversation",
    today: "Today",
    yesterday: "Yesterday",
    customer: "Customer",
    bot: "Bot",
    staff: "Staff",
    sending: "Sending",
    sent: "Sent",
    delivered: "Delivered",
    read: "Read",
    notSent: "Not sent",
  },
  es: {
    conversation: "Conversación",
    today: "Hoy",
    yesterday: "Ayer",
    customer: "Cliente",
    bot: "Bot",
    staff: "Equipo",
    sending: "Enviando",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leído",
    notSent: "No se envió",
  },
} as const satisfies Record<"en" | "es", ChatThreadLabels>;

export type ChatThreadPart =
  | "root"
  | "log"
  | "day"
  | "message"
  | "bubble"
  | "author"
  | "meta"
  | "note"
  | "composer";

export interface ChatThreadProps {
  items: readonly ChatThreadItem[];
  /** Slot under the thread, usually a `Textarea` or `PromptInput` with a send button. */
  composer?: ReactNode;
  /** Texts of the thread (name, day labels, authors, delivery states). English by default; see `chatThreadLabels`. */
  labels?: Partial<ChatThreadLabels>;
  /** Accessible name of the thread. Defaults to `labels.conversation`. */
  label?: string;
  /** Called by the retry button of a `failed` message. Without it the button is not shown. */
  onRetry?: (id: string) => void;
  /** Shown instead of the log while there are no items. */
  empty?: ReactNode;
  /** `Intl` locale for times and day labels. */
  locale?: string;
  /** Time zone for times and day breaks; the local one when omitted. */
  timeZone?: string;
  /** The instant "Today" refers to. Pass a fixed value for stable output. Defaults to the current time. */
  now?: ChatTimestamp;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ChatThreadPart>;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const bubbleTone: Record<ChatAuthorKind, string> = {
  customer: "bg-surface-2 text-ink",
  bot: "border border-accent-line bg-accent-soft text-accent-ink",
  staff: "bg-accent text-on-accent",
};

function Status({ status, labels }: { status: ChatDeliveryStatus; labels: ChatThreadLabels }) {
  const label = {
    sending: labels.sending,
    sent: labels.sent,
    delivered: labels.delivered,
    read: labels.read,
    failed: labels.notSent,
  }[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1",
        status === "read" && "text-accent-ink",
        status === "failed" && "text-danger",
      )}
    >
      {status === "sent" ? <Check aria-hidden="true" className="size-3" /> : null}
      {status === "delivered" || status === "read" ? (
        <CheckCheck aria-hidden="true" className="size-3" />
      ) : null}
      {label}
    </span>
  );
}

/**
 * Business conversation between a customer, a bot and staff: incoming messages on the start side,
 * outgoing ones (bot, staff) on the end side with distinct tones, day separators, optional delivery
 * status, system notes and a composer slot. It is a live `log` that stays at the bottom while new
 * items arrive and you are already there. Colors come from the kit tokens in both schemes. The
 * `ai/` chat parts model user and assistant only; this one models the three authors of a shop chat.
 */
export function ChatThread({
  items,
  composer,
  labels: labelsProp,
  label,
  onRetry,
  empty,
  locale,
  timeZone,
  now,
  className,
  classNames,
}: ChatThreadProps) {
  const labels: ChatThreadLabels = { ...chatThreadLabels.en, ...labelsProp };
  const logRef = useRef<HTMLDivElement>(null);
  const stickToEnd = useRef(true);
  const reference = now ?? new Date();
  const format = { locale, timeZone };
  const authorName = { customer: labels.customer, bot: labels.bot, staff: labels.staff };

  useIsomorphicLayoutEffect(() => {
    const log = logRef.current;
    if (log && stickToEnd.current) log.scrollTop = log.scrollHeight;
  });

  return (
    <section
      aria-label={label ?? labels.conversation}
      className={cn("flex min-h-0 min-w-0 flex-col", classNames?.root, className)}
    >
      {items.length === 0 && empty != null ? (
        <div className="flex flex-1 items-center justify-center p-card">{empty}</div>
      ) : (
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable log must be reachable with the keyboard
          tabIndex={0}
          onScroll={(event) => {
            const log = event.currentTarget;
            stickToEnd.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
          }}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain p-density focus-visible:focus-ring",
            classNames?.log,
          )}
        >
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {withDayBreaks(items, timeZone).map(({ item, dayStart }) => (
              <ChatThreadRow
                key={item.id}
                item={item}
                dayLabel={
                  dayStart
                    ? formatDay(
                        item.at,
                        reference,
                        { today: labels.today, yesterday: labels.yesterday },
                        format,
                      )
                    : undefined
                }
                dayValue={dayStart ? dayKey(item.at, timeZone) : undefined}
                time={formatTime(item.at, format)}
                authorName={authorName}
                labels={labels}
                onRetry={onRetry}
                classNames={classNames}
              />
            ))}
          </ol>
        </div>
      )}
      {composer != null ? (
        <div
          className={cn("shrink-0 border-t-divider p-density", classNames?.composer)}
          data-slot="composer"
        >
          {composer}
        </div>
      ) : null}
    </section>
  );
}

interface RowProps {
  item: ChatThreadItem;
  dayLabel: string | undefined;
  dayValue: string | undefined;
  time: string;
  authorName: Record<ChatAuthorKind, string>;
  labels: ChatThreadLabels;
  onRetry: ((id: string) => void) | undefined;
  classNames: ClassNames<ChatThreadPart> | undefined;
}

function ChatThreadRow({
  item,
  dayLabel,
  dayValue,
  time,
  authorName,
  labels,
  onRetry,
  classNames,
}: RowProps) {
  const strings = useUiStrings();
  return (
    <>
      {dayLabel ? (
        <li className={cn("flex justify-center py-1", classNames?.day)} data-slot="day">
          <time
            dateTime={dayValue}
            className="rounded-badge bg-sunken px-2.5 py-0.5 text-ink-2 text-meta"
          >
            {dayLabel}
          </time>
        </li>
      ) : null}
      {item.kind === "note" ? (
        <li className="flex justify-center" data-kind="note">
          <p
            className={cn(
              "m-0 max-w-[85%] rounded-badge bg-sunken px-3 py-1 text-center text-ink-2 text-meta",
              classNames?.note,
            )}
          >
            {item.content}
          </p>
        </li>
      ) : (
        <li
          data-author={item.author}
          className={cn(
            "flex",
            item.author === "customer" ? "justify-start" : "justify-end",
            classNames?.message,
          )}
        >
          <div
            className={cn(
              "flex min-w-0 max-w-[min(34rem,85%)] flex-col gap-0.5",
              item.author === "customer" ? "items-start" : "items-end",
            )}
          >
            <span className={cn("text-ink-3 text-meta", classNames?.author)}>
              {item.name ?? authorName[item.author]}
            </span>
            <div
              className={cn(
                "min-w-0 whitespace-pre-wrap rounded-card px-3 py-2 text-body [overflow-wrap:anywhere]",
                bubbleTone[item.author],
                classNames?.bubble,
              )}
            >
              {item.content}
            </div>
            <div className={cn("flex items-center gap-2 text-ink-3 text-meta", classNames?.meta)}>
              <time dateTime={new Date(item.at).toISOString()}>{time}</time>
              {item.author !== "customer" && item.status ? (
                <Status status={item.status} labels={labels} />
              ) : null}
              {item.status === "failed" && onRetry ? (
                <Button variant="ghost" size="sm" onClick={() => onRetry(item.id)}>
                  {strings.retry}
                </Button>
              ) : null}
            </div>
          </div>
        </li>
      )}
    </>
  );
}
