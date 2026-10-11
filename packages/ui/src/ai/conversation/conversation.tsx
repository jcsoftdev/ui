"use client";

import { type ComponentPropsWithoutRef, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { nextStuck, showJumpToLatest } from "./stick.js";

export type ConversationPart = "root" | "scroller" | "content" | "jump";

export interface ConversationProps extends Omit<ComponentPropsWithoutRef<"div">, "role"> {
  /** Accessible name of the message log. */
  label?: string;
  /** Label of the "jump to latest" button. */
  jumpLabel?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ConversationPart>;
}

/**
 * Scrollable message log that sticks to the bottom while new content streams in. Scrolling up
 * pauses the follow behavior and reveals a "jump to latest" button. Fills its parent's height.
 */
export function Conversation({
  label = "Conversación",
  jumpLabel = "Ir al último mensaje",
  className,
  classNames,
  children,
  ...props
}: ConversationProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const lastTop = useRef(0);
  const [jump, setJump] = useState(false);
  const reduced = usePrefersReducedMotion();

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    stuck.current = nextStuck(stuck.current, el, lastTop.current);
    lastTop.current = el.scrollTop;
    setJump(showJumpToLatest(stuck.current, el));
  }, []);

  useEffect(() => {
    const inner = content.current;
    if (!inner) return;
    toBottom(false);
    const observer = new ResizeObserver(() => {
      if (stuck.current) toBottom(false);
      else if (scroller.current) setJump(showJumpToLatest(false, scroller.current));
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [toBottom]);

  return (
    <div
      {...props}
      className={cn(
        "@container/conversation relative h-full min-h-0 min-w-0",
        classNames?.root,
        className,
      )}
    >
      <div
        ref={scroller}
        role="log"
        aria-label={label}
        aria-live="polite"
        aria-relevant="additions text"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable log must be keyboard reachable
        tabIndex={0}
        onScroll={onScroll}
        className={cn(
          "h-full overflow-y-auto overscroll-contain focus-visible:focus-ring",
          classNames?.scroller,
        )}
      >
        <div
          ref={content}
          className={cn("mx-auto grid w-full max-w-3xl gap-density-lg p-card", classNames?.content)}
        >
          {children}
        </div>
      </div>
      {jump ? (
        <button
          type="button"
          aria-label={jumpLabel}
          onClick={() => {
            stuck.current = true;
            setJump(false);
            toBottom(!reduced);
          }}
          className={cn(
            "absolute bottom-3 left-1/2 inline-flex h-control-sm -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-button bg-surface-overlay px-3 text-meta text-ink shadow-overlay border-control surface-overlay pressable focus-visible:focus-ring",
            classNames?.jump,
          )}
        >
          <ArrowDown aria-hidden className="size-3.5" />
          <span className="truncate">Más reciente</span>
        </button>
      ) : null}
    </div>
  );
}
