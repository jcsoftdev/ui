import type { ComponentPropsWithoutRef } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../overlays/hover-card/hover-card.js";
import { cn } from "../../utils/cn.js";
import { safeHref } from "../markdown/parse.js";

export interface SourceProps extends Omit<ComponentPropsWithoutRef<"a">, "href" | "title"> {
  /** Citation number shown in the chip. */
  index?: number;
  title: string;
  /** Only http(s) and mailto URLs are linked; anything else renders a non-clickable chip. */
  url: string;
  /** Short excerpt shown in the hover preview. */
  snippet?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Citation chip with a hover/focus preview of the source (title, host and excerpt). */
export function Source({ index, title, url, snippet, className, ...props }: SourceProps) {
  const href = safeHref(url);
  const host = hostOf(url);
  const chipClass = cn(
    "inline-flex h-control-sm min-w-0 max-w-full items-center gap-1.5 rounded-badge bg-surface-control px-2 text-meta text-ink-2 no-underline border-control shadow-control pressable hover:text-ink focus-visible:focus-ring",
    className,
  );
  const chip = (
    <>
      {index != null ? (
        <span className="grid size-4 shrink-0 place-items-center rounded-badge bg-accent-soft text-[10px] font-bold text-accent-ink">
          {index}
        </span>
      ) : null}
      <span className="truncate">{host}</span>
    </>
  );

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={chipClass}
            {...props}
          >
            {chip}
          </a>
        ) : (
          <button type="button" className={chipClass}>
            {chip}
          </button>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="@container/source w-72 max-w-[calc(100vw-1rem)] rounded-popover bg-surface-overlay p-3 text-ink shadow-overlay border-control surface-overlay">
        <p className="text-meta text-ink-3">{host}</p>
        <p className="mt-0.5 line-clamp-2 text-body font-semibold">{title}</p>
        {snippet ? <p className="mt-1 line-clamp-4 text-meta text-ink-2">{snippet}</p> : null}
      </HoverCardContent>
    </HoverCard>
  );
}
