"use client";

import { type PointerEvent, useCallback, useMemo, useReducer, useRef, useState } from "react";
import { cn } from "../../../utils/cn.js";
import {
  type DataPoint,
  EMPTY_INK,
  formatDuration,
  type InkItem,
  inkPath,
  inkReducer,
  type Measure,
  measureSegment,
  signed,
} from "../ink.js";
import type { CartesianOverlay, CartesianPlotInfo } from "./types.js";

export type InkTool = "none" | "ruler" | "ink";

export interface InkLabels {
  /** Name of the toolbar group. */
  tools: string;
  ruler: string;
  ink: string;
  undo: string;
  redo: string;
  clear: string;
  deltaX: string;
  deltaY: string;
  /** Distance along a category axis, e.g. "3 steps". */
  steps: (count: number) => string;
}

export const DEFAULT_INK_LABELS: InkLabels = {
  tools: "Annotation tools",
  ruler: "Ruler",
  ink: "Pen",
  undo: "Undo",
  redo: "Redo",
  clear: "Clear",
  deltaX: "Δx",
  deltaY: "Δy",
  steps: (count) => `${count} ${count === 1 ? "step" : "steps"}`,
};

export interface UseChartInkOptions {
  /** Pen color; the second palette color by default. */
  color?: string;
  /** Tool active at first. */
  tool?: InkTool;
  labels?: Partial<InkLabels>;
}

export interface ChartInk {
  tool: InkTool;
  setTool: (tool: InkTool) => void;
  items: readonly InkItem[];
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  labels: InkLabels;
  /** Spoken description of the last ruler. */
  status: string;
  /** Pass to a vertical cartesian chart: `<LineChart overlay={ink.overlay} />`. */
  overlay: CartesianOverlay;
}

const round = (value: number) => Math.round(value * 10) / 10;

function describe(measure: Measure, plot: CartesianPlotInfo, labels: InkLabels): string {
  const dx =
    plot.xKind === "time" ? formatDuration(measure.dx) : labels.steps(round(Math.abs(measure.dx)));
  const dy = signed(measure.dy, plot.formatY);
  const percent =
    measure.percent == null ? "" : ` (${signed(measure.percent, (v) => `${round(v)} %`)})`;
  return `${labels.deltaX} ${dx} · ${labels.deltaY} ${dy}${percent}`;
}

/**
 * State and overlay of the ruler and freehand-ink tools. Marks are kept in data units, so they stay on
 * their data when the chart is resized, and are drawn inside the chart SVG, so the existing SVG and PNG
 * export includes them. The ruler measures the distance between two points as Δx and Δy; the pen draws
 * a smoothed freehand path.
 */
export function useChartInk({
  color = "var(--chart-cat-2)",
  tool: initialTool = "none",
  labels: labelsProp,
}: UseChartInkOptions = {}): ChartInk {
  const labels = useMemo(() => ({ ...DEFAULT_INK_LABELS, ...labelsProp }), [labelsProp]);
  const [state, dispatch] = useReducer(inkReducer, EMPTY_INK);
  const [tool, setTool] = useState<InkTool>(initialTool);
  const [draft, setDraft] = useState<InkItem | null>(null);
  const [status, setStatus] = useState("");
  const nextId = useRef(1);
  const drawing = useRef(false);

  const overlay = useMemo<CartesianOverlay>(() => {
    const pointOf = (event: PointerEvent<HTMLDivElement>, plot: CartesianPlotInfo): DataPoint => {
      const rect = event.currentTarget.getBoundingClientRect();
      const px = Math.min(plot.width, Math.max(0, event.clientX - rect.left));
      const py = Math.min(plot.height, Math.max(0, event.clientY - rect.top));
      return { x: plot.fromX(px), y: plot.fromY(py) };
    };
    return {
      svg: (plot) => (
        <g
          data-ink=""
          pointerEvents="none"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {[...state.items, ...(draft ? [draft] : [])].map((item) =>
            item.kind === "stroke" ? (
              <path
                key={item.id}
                d={inkPath(item.points.map((p) => ({ x: plot.toX(p.x), y: plot.toY(p.y) })))}
                strokeWidth={2.5}
                style={{ stroke: item.color }}
              />
            ) : (
              <Ruler
                key={item.id}
                a={item.a}
                b={item.b}
                plot={plot}
                text={describe(measureSegment(item.a, item.b), plot, labels)}
              />
            ),
          )}
        </g>
      ),
      html: (plot) =>
        tool === "none" ? null : (
          <div
            data-export-skip=""
            className="absolute touch-none select-none"
            style={{
              left: plot.left,
              top: plot.top,
              width: plot.width,
              height: plot.height,
              cursor: "crosshair",
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drawing.current = true;
              const point = pointOf(event, plot);
              const id = nextId.current++;
              setDraft(
                tool === "ruler"
                  ? { kind: "ruler", id, a: point, b: point }
                  : { kind: "stroke", id, color, points: [point] },
              );
            }}
            onPointerMove={(event) => {
              if (!drawing.current) return;
              const point = pointOf(event, plot);
              setDraft((current) =>
                !current
                  ? current
                  : current.kind === "ruler"
                    ? { ...current, b: point }
                    : { ...current, points: [...current.points, point] },
              );
            }}
            onPointerUp={(event) => {
              if (!drawing.current) return;
              drawing.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              const done = draft;
              setDraft(null);
              if (!done) return;
              if (done.kind === "ruler") {
                const length = Math.hypot(
                  plot.toX(done.b.x) - plot.toX(done.a.x),
                  plot.toY(done.b.y) - plot.toY(done.a.y),
                );
                if (length < 4) return;
                setStatus(describe(measureSegment(done.a, done.b), plot, labels));
              }
              dispatch({ type: "add", item: done });
            }}
            onPointerCancel={() => {
              drawing.current = false;
              setDraft(null);
            }}
          />
        ),
    };
  }, [state.items, draft, tool, color, labels]);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const clear = useCallback(() => {
    dispatch({ type: "clear" });
    setStatus("");
  }, []);

  return {
    tool,
    setTool,
    items: state.items,
    canUndo: state.items.length > 0,
    canRedo: state.redo.length > 0,
    canClear: state.items.length > 0 || state.redo.length > 0,
    undo,
    redo,
    clear,
    labels,
    status,
    overlay,
  };
}

function Ruler({
  a,
  b,
  plot,
  text,
}: {
  a: DataPoint;
  b: DataPoint;
  plot: CartesianPlotInfo;
  text: string;
}) {
  const ax = plot.toX(a.x);
  const ay = plot.toY(a.y);
  const bx = plot.toX(b.x);
  const by = plot.toY(b.y);
  const width = text.length * 6.7 + 16;
  const height = 22;
  const x = Math.min(Math.max(0, (ax + bx) / 2 - width / 2), Math.max(0, plot.width - width));
  const y = Math.min(Math.max(0, Math.min(ay, by) - height - 8), Math.max(0, plot.height - height));
  return (
    <g>
      <path
        d={`M${ax},${ay}H${bx}V${by}`}
        strokeWidth={1}
        strokeDasharray="3 4"
        style={{ stroke: "var(--ink-3)" }}
      />
      <line x1={ax} y1={ay} x2={bx} y2={by} strokeWidth={2} style={{ stroke: "var(--ink)" }} />
      {(
        [
          ["start", ax, ay],
          ["end", bx, by],
        ] as const
      ).map(([end, cx, cy]) => (
        <circle
          key={end}
          cx={cx}
          cy={cy}
          r={4}
          strokeWidth={2}
          style={{ fill: "var(--surface)", stroke: "var(--ink)" }}
        />
      ))}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        style={{ fill: "var(--surface)", stroke: "var(--line-strong)" }}
      />
      <text
        x={x + width / 2}
        y={y + 15}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        stroke="none"
        style={{ fill: "var(--ink)" }}
      >
        {text}
      </text>
    </g>
  );
}

const buttonClass =
  "inline-flex h-7 cursor-pointer items-center rounded-button border-0 px-3 font-semibold text-[12px] outline-none focus-visible:outline-2 focus-visible:outline-accent-ink disabled:cursor-not-allowed disabled:opacity-40";

/** Buttons for the ruler and pen tools plus undo, redo and clear. Place it next to the chart. */
export function ChartInkToolbar({ ink, className }: { ink: ChartInk; className?: string }) {
  const { labels } = ink;
  const tool = (id: "ruler" | "ink") => (
    <button
      type="button"
      aria-pressed={ink.tool === id}
      onClick={() => ink.setTool(ink.tool === id ? "none" : id)}
      className={cn(
        buttonClass,
        ink.tool === id
          ? "bg-accent-soft text-accent-ink"
          : "bg-surface-2 text-ink-2 hover:text-ink",
      )}
    >
      {labels[id]}
    </button>
  );
  const action = (
    name: keyof Pick<InkLabels, "undo" | "redo" | "clear">,
    run: () => void,
    enabled: boolean,
  ) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={run}
      className={cn(buttonClass, "bg-surface-2 text-ink-2 enabled:hover:text-ink")}
    >
      {labels[name]}
    </button>
  );
  return (
    <div
      role="toolbar"
      aria-label={labels.tools}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {tool("ruler")}
      {tool("ink")}
      {action("undo", ink.undo, ink.canUndo)}
      {action("redo", ink.redo, ink.canRedo)}
      {action("clear", ink.clear, ink.canClear)}
      <span className="sr-only" aria-live="polite">
        {ink.status}
      </span>
    </div>
  );
}
