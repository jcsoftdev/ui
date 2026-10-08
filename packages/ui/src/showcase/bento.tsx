import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { cn } from "../utils/cn.js";

/** Columns a tile spans at each container width; literal strings so Tailwind can see them. */
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

type Span = 1 | 2 | 3 | 4 | 5 | 6;

/** Column-span classes for a grid child that is not a Tile (a component that is already a card). */
export function columnSpan(cols: Span) {
  return cn(WIDE[cols], MID[cols], SMALL[cols]);
}

/**
 * Bento grid: 1 column under 480 px of container width, 2 from 480, 4 from 880 and 6 from 1280.
 * Rows share one height unit so tall tiles line up; `grid-auto-flow: dense` fills the holes.
 */
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
    <div
      className={cn(
        "grid min-w-0 grid-flow-dense grid-cols-1 gap-density @min-[480px]/bento:grid-cols-2 @min-[880px]/bento:grid-cols-4 @min-[1280px]/bento:grid-cols-6",
        className,
      )}
      style={{ gridAutoRows: `${rowHeight}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export interface TileProps {
  title?: string;
  subtitle?: string;
  /** Slot at the end of the header: a chip, a status pill, a button. */
  aside?: ReactNode;
  /** Columns at the widest layout (6 columns); it shrinks on its own in narrower containers. */
  cols?: Span;
  /** Rows of the shared height unit. */
  rows?: Span;
  /** Entrance order, drives the stagger. */
  index?: number;
  /** Remove the body padding, for grids and tables that bring their own. */
  flush?: boolean;
  /** Center the body content. */
  center?: boolean;
  children: ReactNode;
  className?: string;
}

/** A bento tile: a card made only of role tokens, so every style preset restyles it. */
export function Tile({
  title,
  subtitle,
  aside,
  cols = 2,
  rows = 2,
  index = 0,
  flush = false,
  center = false,
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
      {title ? (
        <header className="flex min-w-0 shrink-0 items-start gap-density-sm px-card pt-card">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 truncate text-card-title text-ink">{title}</h3>
            {subtitle ? <p className="m-0 truncate text-ink-3 text-meta">{subtitle}</p> : null}
          </div>
          {aside}
        </header>
      ) : null}
      <div
        className={cn(
          "relative min-h-0 min-w-0 flex-1",
          flush ? "" : "p-card",
          title && !flush ? "pt-density-sm" : "",
          center ? "flex items-center justify-center" : "",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Wrapper element for portaled overlays that support a `container` prop. */
export const OverlayContainer = createContext<HTMLElement | null>(null);

export function useOverlayContainer() {
  return useContext(OverlayContainer);
}

/** Section heading used by the Overview story. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 pt-density-lg pb-density-sm">
      <span className="font-semibold text-accent-ink text-meta uppercase tracking-wider">
        {eyebrow}
      </span>
      <h2 className="m-0 text-page-title text-ink">{title}</h2>
      <p className="m-0 max-w-prose text-body text-ink-2">{lede}</p>
    </div>
  );
}
