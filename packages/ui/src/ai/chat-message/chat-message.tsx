import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Avatar } from "../../atoms/avatar/avatar.js";
import { CircleAlert } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { Loader } from "../loader/loader.js";
import { Markdown } from "../markdown/markdown.js";

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "streaming" | "done" | "error";

export interface ChatMessageProps extends Omit<ComponentPropsWithoutRef<"article">, "content"> {
  author: ChatRole;
  /** Display name, also the avatar's accessible name. */
  name?: string;
  avatarSrc?: string;
  /** `sending` and `streaming` show activity; `error` shows the failure line. */
  status?: ChatMessageStatus;
  /** Time label shown under the bubble (already formatted). */
  time?: string;
  /** Markdown text. Assistant messages render it as Markdown; user and system as plain text. */
  content?: string;
  /** Rich body; replaces `content`. */
  children?: ReactNode;
  /** Slot under the bubble (e.g. MessageActions, sources). */
  footer?: ReactNode;
  /** Text of the failure line when `status` is `error`. */
  errorText?: string;
}

/** One chat turn: avatar, bubble, status, streaming caret and an optional footer slot. */
export function ChatMessage({
  author,
  name,
  avatarSrc,
  status = "done",
  time,
  content,
  children,
  footer,
  errorText = "No se pudo enviar el mensaje.",
  className,
  ...props
}: ChatMessageProps) {
  const streaming = status === "streaming";

  if (author === "system") {
    return (
      <article
        className={cn("flex justify-center", className)}
        aria-label={name ?? "Sistema"}
        {...props}
      >
        <p className="max-w-full rounded-badge bg-surface-sunken px-3 py-1 text-center text-meta text-ink-3">
          {children ?? content}
        </p>
      </article>
    );
  }

  const user = author === "user";
  const body =
    children ??
    (user ? (
      <p className="whitespace-pre-wrap break-words text-body">{content}</p>
    ) : (
      <Markdown streaming={streaming}>{content ?? ""}</Markdown>
    ));
  const waiting = !user && streaming && !content && !children;

  return (
    <article
      aria-label={name ?? (user ? "Tú" : "Asistente")}
      aria-busy={streaming || status === "sending" ? "true" : undefined}
      className={cn(
        "@container/message flex min-w-0 gap-density-sm",
        user ? "flex-row-reverse" : "flex-row",
        className,
      )}
      {...props}
    >
      <Avatar
        name={name ?? (user ? "Tú" : "Asistente")}
        src={avatarSrc}
        highlighted={!user}
        className="mt-0.5"
      />
      <div
        className={cn(
          "grid min-w-0 max-w-[92%] gap-1 @md/message:max-w-[80%]",
          user && "justify-items-end",
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full rounded-card px-3 py-2",
            user ? "bg-accent-soft text-ink" : "bg-surface-card text-ink border-card shadow-card",
            status === "error" && "bg-danger-soft",
            status === "sending" && "opacity-70",
          )}
        >
          {waiting ? <Loader size="sm" label="El asistente está escribiendo" /> : body}
        </div>
        {status === "error" ? (
          <p role="alert" className="flex items-center gap-1 text-meta text-danger">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {errorText}
          </p>
        ) : null}
        {time || status === "sending" ? (
          <p className="text-meta text-ink-3">{status === "sending" ? "Enviando…" : time}</p>
        ) : null}
        {footer}
      </div>
    </article>
  );
}
