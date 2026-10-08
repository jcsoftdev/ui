import { cn } from "@jcsoftdev/ui/utils";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

/** True after the first client render: heavy demos render nothing before it, so SSR and hydration agree. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

type Span = 1 | 2 | 3 | 4 | 5 | 6;

// Literal class strings so Tailwind can see them. The grid is a container: 1 / 2 / 4 / 6 columns.
const WIDE = [
  "",
  "@min-[1280px]/bento:col-span-1",
  "@min-[1280px]/bento:col-span-2",
  "@min-[1280px]/bento:col-span-3",
  "@min-[1280px]/bento:col-span-4",
  "@min-[1280px]/bento:col-span-5",
  "@min-[1280px]/bento:col-span-6",
] as const;
const MID = [
  "",
  "@min-[880px]/bento:col-span-1",
  "@min-[880px]/bento:col-span-2",
  "@min-[880px]/bento:col-span-3",
  "@min-[880px]/bento:col-span-4",
  "@min-[880px]/bento:col-span-4",
  "@min-[880px]/bento:col-span-4",
] as const;
const SMALL = [
  "",
  "@min-[480px]/bento:col-span-1",
  "@min-[480px]/bento:col-span-2",
  "@min-[480px]/bento:col-span-2",
  "@min-[480px]/bento:col-span-2",
  "@min-[480px]/bento:col-span-2",
  "@min-[480px]/bento:col-span-2",
] as const;
const ROWS = [
  "",
  "row-span-1",
  "row-span-2",
  "row-span-3",
  "row-span-4",
  "row-span-5",
  "row-span-6",
] as const;

export interface TileProps {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  cols?: Span;
  rows?: Span;
  /** Entrance order for the stagger. */
  index?: number;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

/** A bento tile made only of role tokens, so every style preset restyles it. */
export function Tile({
  title,
  subtitle,
  aside,
  cols = 2,
  rows = 2,
  index = 0,
  flush = false,
  children,
  className,
}: TileProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "bento-tile @container/tile flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border-card shadow-card surface-card",
        WIDE[cols],
        MID[cols],
        SMALL[cols],
        ROWS[rows],
        className,
      )}
      style={{ "--bento-i": index } as CSSProperties}
    >
      <header className="flex min-w-0 shrink-0 items-start gap-density-sm px-card pt-card">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-card-title text-ink">{title}</h3>
          {subtitle ? <p className="m-0 truncate text-ink-3 text-meta">{subtitle}</p> : null}
        </div>
        {aside}
      </header>
      <div
        className={cn(
          "relative min-h-0 min-w-0 flex-1",
          flush ? "pt-density-sm" : "p-card pt-density-sm",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function BentoGrid({
  rowHeight = 132,
  children,
  className,
}: {
  rowHeight?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="@container/bento min-w-0">
      <div
        className={cn(
          "grid min-w-0 grid-flow-dense grid-cols-1 gap-density @min-[480px]/bento:grid-cols-2 @min-[880px]/bento:grid-cols-4 @min-[1280px]/bento:grid-cols-6",
          className,
        )}
        style={{ gridAutoRows: `${rowHeight}px` }}
      >
        {children}
      </div>
    </div>
  );
}

/** Body of a tile before its demo mounts: reserves the space so nothing jumps. */
export function TileSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="grid h-full place-items-center">
      <span className="size-6 animate-pulse rounded-full bg-surface-2" />
    </div>
  );
}
