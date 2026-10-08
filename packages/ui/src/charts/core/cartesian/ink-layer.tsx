"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { cn } from "../../../utils/cn.js";
import {
  type CursorDomain,
  type CursorKey,
  cursorAction,
  type DataPoint,
  EMPTY_INK,
  formatDuration,
  type InkItem,
  inkPath,
  inkReducer,
  type Measure,
  measureSegment,
  moveCursor,
  pixelToPlot,
  plotDomain,
  plotToPixel,
  signed,
  startCursor,
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
  /** Horizontal bars: change of the value (read along x) and distance between categories. */
  deltaValue: string;
  deltaCategory: string;
  /** Distance along a category axis, e.g. "3 steps". */
  steps: (count: number) => string;
  /** Accessible name of the plot while a tool is active (keyboard use). */
  plot: string;
  /** Spoken position of the crosshair; receives the formatted x and y. */
  position: (x: string, y: string) => string;
  /** Spoken count of the points already set. */
  pending: (count: number) => string;
  /** Spoken when a pen stroke is finished. */
  finished: string;
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
  deltaValue: "Δ value",
  deltaCategory: "Δ category",
  steps: (count) => `${count} ${count === 1 ? "step" : "steps"}`,
  plot: "Annotation plot: arrows move the crosshair, Shift moves faster, Space sets a point, Enter finishes, Escape cancels",
  position: (x, y) => `${x}, ${y}`,
  pending: (count) => `${count} ${count === 1 ? "point" : "points"} set`,
  finished: "Stroke finished",
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
  /** Pass to a cartesian chart (vertical or horizontal bars): `<LineChart overlay={ink.overlay} />`. */
  overlay: CartesianOverlay;
}

const round = (value: number) => Math.round(value * 10) / 10;

function describe(measure: Measure, plot: CartesianPlotInfo, labels: InkLabels): string {
  const dx =
    plot.xKind === "time" ? formatDuration(measure.dx) : labels.steps(round(Math.abs(measure.dx)));
  const dy = signed(measure.dy, plot.formatY);
  const percent =
    measure.percent == null ? "" : ` (${signed(measure.percent, (v) => `${round(v)} %`)})`;
  if (plot.horizontal) {
    return `${labels.deltaValue} ${dy}${percent} · ${labels.deltaCategory} ${dx}`;
  }
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
  const [cursor, setCursor] = useState<DataPoint | null>(null);
  const [placed, setPlaced] = useState<DataPoint[]>([]);
  const nextId = useRef(1);
  const drawing = useRef(false);

  const overlay = useMemo<CartesianOverlay>(() => {
    const keyboardDraft = (at: DataPoint | null, points: readonly DataPoint[]): InkItem[] => {
      if (!at || points.length === 0) return [];
      if (tool === "ruler") {
        return [{ kind: "ruler", id: -1, a: points[0] as DataPoint, b: at }];
      }
      return [{ kind: "stroke", id: -1, color, points: [...points, at] }];
    };

    const domainOf = (plot: CartesianPlotInfo): CursorDomain => plotDomain(plot);
    const reset = () => {
      setCursor(null);
      setPlaced([]);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, plot: CartesianPlotInfo) => {
      if (tool === "none") return;
      const domain = domainOf(plot);
      const key = event.key;
      if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) =>
          moveCursor(
            current ?? startCursor(domain),
            key as CursorKey,
            event.shiftKey,
            domain,
            plot.horizontal,
          ),
        );
        return;
      }
      if (key !== " " && key !== "Enter" && key !== "Escape") return;
      event.preventDefault();
      const at = cursor ?? startCursor(domain);
      const action = cursorAction(tool === "ruler" ? "ruler" : "ink", key, placed, at);
      if (action.type === "cancel") {
        if (placed.length > 0) setPlaced([]);
        else setCursor(null);
        return;
      }
      setCursor(at);
      if (action.type === "pending") {
        setPlaced(action.points);
        return;
      }
      const id = nextId.current++;
      const [first, last] = [
        action.points[0] as DataPoint,
        action.points[action.points.length - 1],
      ];
      if (tool === "ruler") {
        const item: InkItem = { kind: "ruler", id, a: first, b: last as DataPoint };
        setStatus(describe(measureSegment(item.a, (item as { b: DataPoint }).b), plot, labels));
        dispatch({ type: "add", item });
      } else {
        dispatch({ type: "add", item: { kind: "stroke", id, color, points: action.points } });
        setStatus(labels.finished);
      }
      setPlaced([]);
    };
    const pointOf = (event: PointerEvent<HTMLDivElement>, plot: CartesianPlotInfo): DataPoint => {
      const rect = event.currentTarget.getBoundingClientRect();
      return pixelToPlot(plot, { x: event.clientX - rect.left, y: event.clientY - rect.top });
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
          {[...state.items, ...(draft ? [draft] : []), ...keyboardDraft(cursor, placed)].map(
            (item) =>
              item.kind === "stroke" ? (
                <path
                  key={item.id}
                  d={inkPath(item.points.map((p) => plotToPixel(plot, p)))}
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
          {cursor ? <Crosshair at={cursor} plot={plot} /> : null}
        </g>
      ),
      html: (plot) =>
        tool === "none" ? null : (
          <div
            data-export-skip=""
            role="slider"
            tabIndex={0}
            aria-label={labels.plot}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={cursor ? 1 : 0}
            aria-valuetext={
              cursor
                ? `${labels.position(plot.formatX(cursor.x), plot.formatY(cursor.y))}${placed.length ? `. ${labels.pending(placed.length)}` : ""}`
                : labels.plot
            }
            onKeyDown={(event) => onKeyDown(event, plot)}
            onFocus={(event) => {
              if (!cursor && event.currentTarget.matches(":focus-visible")) {
                setCursor(startCursor(domainOf(plot)));
              }
            }}
            onBlur={reset}
            className="absolute touch-none select-none outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
            style={{
              left: plot.left,
              top: plot.top,
              width: plot.width,
              height: plot.height,
              cursor: "crosshair",
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              reset();
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
                const from = plotToPixel(plot, done.a);
                const to = plotToPixel(plot, done.b);
                const length = Math.hypot(to.x - from.x, to.y - from.y);
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
  }, [state.items, draft, tool, color, labels, cursor, placed]);

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

function Crosshair({ at, plot }: { at: DataPoint; plot: CartesianPlotInfo }) {
  const { x, y } = plotToPixel(plot, at);
  return (
    <g data-crosshair="" strokeWidth={1} style={{ stroke: "var(--ink-2)" }}>
      <path d={`M${x},0V${plot.height}M0,${y}H${plot.width}`} strokeDasharray="2 3" />
      <circle cx={x} cy={y} r={5} fill="none" strokeWidth={2} />
    </g>
  );
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
  const { x: ax, y: ay } = plotToPixel(plot, a);
  const { x: bx, y: by } = plotToPixel(plot, b);
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
