"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";
import { type ChartDockMode, useChartDock } from "./chart-dock.js";
import type { LegendShape } from "./legend.js";
import { useIsomorphicLayoutEffect } from "./use-chart-size.js";

const OFFSET = 14;
const EDGE = 4;
/** A card on the right moves left only past this share of the container width. */
const FLIP_LEFT_AT = 0.65;
/** A card on the left moves back right only below this share: a dead zone against jitter. */
const FLIP_RIGHT_AT = 0.55;

export interface TooltipRow {
  id: string;
  name: string;
  value: string;
  color: string;
  shape?: LegendShape;
  /** Secondary text after the value, e.g. a share "(32%)". */
  note?: string;
  /** Rendered bold and separated, e.g. a total. */
  emphasis?: boolean;
}

export interface ChartTooltipProps {
  /** Anchor in pixels, relative to the positioned chart container. */
  x: number;
  y: number;
  /** Width of the container; the tooltip prefers the left of the anchor past 60% and never leaves it. */
  containerWidth: number;
  /** Height of the container; when given, the card is kept inside it vertically too. */
  containerHeight?: number;
  title?: ReactNode;
  rows: readonly TooltipRow[];
  /** Wrapped sentence under the title, for notes that are not series values. */
  body?: string;
  /** Content under the rows. */
  footer?: ReactNode;
  /** Forces the side of the anchor the card opens on (when it fits); by default it follows the anchor. */
  side?: "left" | "right";
  /**
   * `auto` (default) docks the details in the frame's panel under the plot when the frame is 480px
   * wide or less, or the primary pointer is coarse. `never` always floats. `always` docks whenever
   * the enclosing `ChartFrame` has a panel, which it only has when it docks itself: set `dock` on
   * the `ChartFrame` too (without a panel the card floats).
   */
  dock?: ChartDockMode;
  className?: string;
}

type Side = "left" | "right";

/**
 * Floating card that lists every series at the hovered position. Purely
 * visual (`aria-hidden`): screen readers get the same numbers from the live
 * region and the hidden data table. Moves with a GPU transform, so following
 * the pointer never triggers layout. Its own width is measured so the card
 * always stays inside the container: it takes the side of the anchor with
 * room, and is clamped to the edges when neither side fits (narrow charts).
 * The side only changes past a dead zone, and a side swap jumps instead of
 * sliding across the pointer.
 *
 * Docked (see `dock`), the same rows render in the frame's live panel below
 * the plot instead, which is how touch screens read them.
 */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  containerHeight,
  title,
  rows,
  body,
  footer,
  side,
  dock = "auto",
  className,
}: ChartTooltipProps) {
  const frame = useChartDock();
  const ref = useRef<HTMLDivElement>(null);
  const committed = useRef<Side | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useIsomorphicLayoutEffect(() => {
    const width = ref.current?.offsetWidth ?? 0;
    const height = ref.current?.offsetHeight ?? 0;
    if (Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5)
      setSize({ width, height });
  });
  const chosen = chooseTooltipSide(committed.current, x, size.width, containerWidth, side);
  const swapped = committed.current != null && committed.current !== chosen;
  useIsomorphicLayoutEffect(() => {
    committed.current = chosen;
  });

  const docked = dock === "never" ? false : dock === "always" ? true : frame.docked;
  if (docked && frame.slot) {
    return createPortal(
      <DockedDetails
        title={title}
        body={body}
        rows={rows}
        footer={footer}
        announce={frame.announce}
      />,
      frame.slot,
    );
  }

  const left = leftOnSide(chosen, x, size.width, containerWidth);
  const top = containerHeight == null ? y : tooltipCenterY(y, size.height, containerHeight);
  return (
    <div
      ref={ref}
      data-chart-tooltip=""
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-10 min-w-30 rounded-popover surface-overlay px-3 py-2.5 text-fs-120 shadow-overlay",
        !swapped &&
          "motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out",
        className,
      )}
      style={{
        maxWidth: Math.max(120, Math.min(260, containerWidth - EDGE * 2)),
        transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0) translateY(-50%)`,
      }}
    >
      <TooltipBody title={title} body={body} rows={rows} footer={footer} />
    </div>
  );
}

interface BodyProps {
  title?: ReactNode;
  body?: string;
  rows: readonly TooltipRow[];
  footer?: ReactNode;
  rowClassName?: string;
}

function TooltipBody({ title, body, rows, footer, rowClassName }: BodyProps) {
  return (
    <>
      {title ? <div className="mb-1.5 font-bold text-fs-120 text-ink">{title}</div> : null}
      {body ? <div className="text-ink-2 leading-snug">{body}</div> : null}
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "flex items-center gap-2 text-ink-2",
              row.emphasis && "mt-0.5 border-t-divider pt-1.5 text-ink",
              rowClassName,
            )}
          >
            {row.emphasis ? (
              <span className="w-2.5 shrink-0" />
            ) : (
              <span
                className={cn(
                  "size-2.5 shrink-0",
                  row.shape === "line" || row.shape === "dashed" || row.shape === "dot"
                    ? "rounded-pill"
                    : "rounded-xs",
                )}
                style={{ background: row.color }}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="font-bold text-ink tabular-nums">{row.value}</span>
            {row.note ? <span className="text-ink-3 tabular-nums">{row.note}</span> : null}
          </div>
        ))}
      </div>
      {footer ? <div className="mt-1.5 text-ink-2">{footer}</div> : null}
    </>
  );
}

/** Details inside the frame's docked panel: in flow, full width, rows at least 44px tall. */
function DockedDetails({
  title,
  body,
  rows,
  footer,
  announce,
}: BodyProps & { announce: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    announce(ref.current?.textContent ?? "");
  });
  useEffect(() => () => announce(""), [announce]);
  return (
    <div
      ref={ref}
      data-chart-tooltip=""
      data-docked=""
      className="rounded-popover surface-overlay px-3 py-2 text-fs-130"
    >
      <TooltipBody title={title} body={body} rows={rows} footer={footer} rowClassName="min-h-11" />
    </div>
  );
}

/**
 * Side of the anchor a card `width` wide opens on. Unless `forced`, it keeps `previous` while that
 * side fits and the pointer stays inside the dead zone (right of the anchor until 65% of the
 * container, left of it until 55%), so a 1-2px move never swaps sides.
 */
export function chooseTooltipSide(
  previous: Side | undefined,
  x: number,
  width: number,
  containerWidth: number,
  forced?: Side,
): Side {
  const share = containerWidth > 0 ? x / containerWidth : 0;
  let wanted: Side;
  if (forced) wanted = forced;
  else if (previous === "left") wanted = share < FLIP_RIGHT_AT ? "right" : "left";
  else if (previous === "right") wanted = share > FLIP_LEFT_AT ? "left" : "right";
  else wanted = share > 0.6 ? "left" : "right";
  const fitsRight = x + OFFSET + width <= containerWidth - EDGE;
  const fitsLeft = x - OFFSET - width >= EDGE;
  if (wanted === "left" ? fitsLeft : fitsRight) return wanted;
  if (wanted === "left" ? fitsRight : fitsLeft) return wanted === "left" ? "right" : "left";
  return "right";
}

function leftOnSide(side: Side, x: number, width: number, containerWidth: number): number {
  const target = side === "left" ? x - OFFSET - width : x + OFFSET;
  return Math.max(EDGE, Math.min(target, containerWidth - width - EDGE));
}

/** Left edge of a tooltip `width` wide next to anchor `x`, kept inside `containerWidth`. */
export function tooltipLeft(x: number, width: number, containerWidth: number, side?: Side): number {
  return leftOnSide(
    chooseTooltipSide(undefined, x, width, containerWidth, side),
    x,
    width,
    containerWidth,
  );
}

/** Vertical centre of a card `height` tall at anchor `y`, kept inside `containerHeight` when it fits. */
export function tooltipCenterY(y: number, height: number, containerHeight: number): number {
  const min = height / 2 + EDGE;
  const max = containerHeight - height / 2 - EDGE;
  return max < min ? containerHeight / 2 : Math.max(min, Math.min(y, max));
}
