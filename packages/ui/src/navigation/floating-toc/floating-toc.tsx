"use client";

import { type ComponentPropsWithoutRef, type RefObject, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { pickActive, type TocItem } from "./model.js";

export interface FloatingTocProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  items: TocItem[];
  /** Heading shown above the list. */
  title?: string;
  /**
   * Scroll container that holds the headings. Omit to observe the viewport.
   * Pass a ref (not the element) so it can be resolved after mount.
   */
  scrollRoot?: RefObject<HTMLElement | null>;
  /** Called when the active section changes. */
  onActiveChange?: (id: string | null) => void;
  /** Pixels reserved at the top (sticky headers) when jumping to a section. */
  offsetTop?: number;
}

const indent = { 1: "ps-0", 2: "ps-3", 3: "ps-6" } as const;

/**
 * Table of contents that tracks the section being read. An IntersectionObserver watches the
 * top band of the scroll area; the first heading inside it is current (`aria-current="location"`).
 */
export function FloatingToc({
  items,
  title = "En esta página",
  scrollRoot,
  onActiveChange,
  offsetTop = 0,
  className,
  ...props
}: FloatingTocProps) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const visible = useRef(new Set<string>());
  const activeRef = useRef(active);
  const emit = useRef(onActiveChange);
  emit.current = onActiveChange;
  const ids = items.map((item) => item.id).join("|");

  useEffect(() => {
    const order = ids.split("|").filter(Boolean);
    const root = scrollRoot?.current ?? null;
    visible.current.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.current.add(entry.target.id);
          else visible.current.delete(entry.target.id);
        }
        const next = pickActive(order, visible.current, activeRef.current);
        if (next !== activeRef.current) {
          activeRef.current = next;
          setActive(next);
          emit.current?.(next);
        }
      },
      // Top 30% of the scroll area counts as "reading here".
      { root, rootMargin: `-${offsetTop}px 0px -70% 0px`, threshold: 0 },
    );
    const scope: ParentNode = root ?? document;
    for (const id of order) {
      const el = scope.querySelector(`#${CSS.escape(id)}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids, scrollRoot, offsetTop]);

  const jump = (id: string) => {
    const root = scrollRoot?.current ?? null;
    const el = (root ?? document).querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    activeRef.current = id;
    setActive(id);
    emit.current?.(id);
  };

  return (
    <nav aria-label={title} className={cn("@container/toc min-w-0", className)} {...props}>
      <p className="m-0 pb-density-sm text-ink-3 text-overline uppercase">{title}</p>
      <ol className="m-0 flex list-none flex-col border-s-2 border-divider p-0">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="min-w-0">
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  jump(item.id);
                }}
                className={cn(
                  "-ms-0.5 block min-w-0 truncate border-s-2 py-1.5 pe-density-sm text-meta no-underline transition-colors duration-(--motion-duration) ease-style focus-visible:focus-ring",
                  "ps-density",
                  current
                    ? "border-accent font-semibold text-accent-ink"
                    : "border-transparent text-ink-3 hover:text-ink",
                )}
              >
                <span className={cn("block truncate", indent[item.level ?? 1])}>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
