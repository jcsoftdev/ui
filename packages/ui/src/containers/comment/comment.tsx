import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type CommentTone = "pending" | "reply";

const toneClasses: Record<CommentTone, string> = {
  pending: "bg-warning-soft",
  reply: "bg-surface-2",
};

const toneAuthorClasses: Record<CommentTone, string> = {
  pending: "text-warning",
  reply: "text-ink",
};

export interface CommentProps extends Omit<ComponentPropsWithoutRef<"div">, "role"> {
  tone?: CommentTone;
  /** Name of the commenter. */
  author: string;
  /** Accessible name of the note (`role=note` takes no name from content). */
  label: string;
  /** Optional counter shown before the author. */
  number?: number;
  children?: ReactNode;
}

/** Annotation callout on a document: bold author, optional counter, body. */
export function Comment({
  tone = "pending",
  author,
  label,
  number,
  className,
  children,
  ...props
}: CommentProps) {
  return (
    <div
      role="note"
      aria-label={label}
      className={cn(
        "mx-4 mb-3.5 break-words rounded-control px-3 py-2.5 text-[12.5px]",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      <b className={cn("font-semibold", toneAuthorClasses[tone])}>
        {number != null ? `${number} · ` : null}
        {author}
      </b>
      {" — "}
      {children}
    </div>
  );
}
