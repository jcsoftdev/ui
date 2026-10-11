"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { useReducedMotion } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { type RaceFrame, raceItems, visibleMax } from "./bar-race.js";

export interface BarRaceEntity {
  id: string;
  name: string;
  /** CSS color or token; defaults to the palette slot of the entity. */
  color?: string;
}

export interface BarRaceChartProps {
  entities: readonly BarRaceEntity[];
  /** One entry per moment; `values[i]` belongs to `entities[i]`. */
  frames: readonly RaceFrame[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** How many bars race at once (default 6). */
  topN?: number;
  /** Milliseconds between two frames (default 1400). */
  frameDuration?: number;
  /** Starts playing (default true; reduced motion starts paused). */
  defaultPlaying?: boolean;
  /** Starts over after the last frame (default true). */
  loop?: boolean;
  valueFormat?: ValueFormat;
  height?: number | "fill";
  aspectRatio?: number;
  loading?: boolean;
  playLabel?: string;
  pauseLabel?: string;
  /** Accessible name of the moment slider. */
  momentLabel?: string;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const ROW_GAP = 0.22;

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      {playing ? (
        <path
          d="M7 5v14M17 5v14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M8 5.5v13l11-6.5z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Bar race: horizontal bars that grow, shrink and swap places as time moves
 * through `frames`. Play/pause, scrub with the slider, `topN` limits the rows.
 * Under `prefers-reduced-motion` the bars step from frame to frame.
 */
export function BarRaceChart({
  entities,
  frames,
  title,
  description,
  topN = 6,
  frameDuration = 1400,
  defaultPlaying = true,
  loop = true,
  valueFormat,
  height = 340,
  aspectRatio,
  loading,
  playLabel = "Play",
  pauseLabel = "Pause",
  momentLabel = "Moment",
  labels: labelOverrides,
  className,
}: BarRaceChartProps) {
  const labels = resolveLabels(labelOverrides);
  const reduced = useReducedMotion();
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const last = Math.max(0, frames.length - 1);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(defaultPlaying);
  const stamp = useRef<number | null>(null);
  const current = useRef(0);
  current.current = position;

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    if (!playing || last === 0 || typeof requestAnimationFrame !== "function") return;
    stamp.current = null;
    let frame = 0;
    const step = (now: number) => {
      const previous = stamp.current ?? now;
      stamp.current = now;
      const delta = (now - previous) / frameDuration;
      let next = current.current + delta;
      if (next >= last) {
        if (loop) next -= last;
        else {
          next = last;
          setPlaying(false);
        }
      }
      current.current = next;
      setPosition(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, last, frameDuration, loop]);

  const shown = reduced ? Math.round(position) : position;
  const frameIndex = Math.min(last, Math.round(shown));
  const caption = frames[frameIndex]?.label ?? "";
  const limit = Math.max(1, Math.min(topN, entities.length));

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={entities.length === 0 || frames.length === 0}
      skeleton="bars"
      className={className}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!playing && position >= last) setPosition(0);
              setPlaying((value) => !value);
            }}
            aria-label={playing ? pauseLabel : playLabel}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-button border-0 bg-surface-2 text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
          >
            <PlayIcon playing={playing} />
          </button>
          <input
            type="range"
            min={0}
            max={last}
            step={0.01}
            value={Math.min(position, last)}
            aria-label={momentLabel}
            aria-valuetext={caption}
            onChange={(event) => {
              setPlaying(false);
              setPosition(Number(event.currentTarget.value));
            }}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-(--accent)"
          />
          <span className="min-w-12 text-right font-bold text-fs-120 text-ink-2 tabular-nums">
            {caption}
          </span>
        </div>
      }
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={entities.map((entity) => entity.name)}
          columns={frames.map((frame, index) => ({
            id: `${index}-${frame.label}`,
            name: frame.label,
            values: entities.map((_, entity) => fmt(frame.values[entity] ?? 0)),
          }))}
        />
      }
    >
      {(width, measuredHeight) => (
        <RacePlot
          width={width}
          height={measuredHeight}
          entities={entities}
          frames={frames}
          position={shown}
          limit={limit}
          caption={caption}
          fmt={fmt}
          title={title}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  entities: readonly BarRaceEntity[];
  frames: readonly RaceFrame[];
  position: number;
  limit: number;
  caption: string;
  fmt: (value: number) => string;
  title: string;
}

function RacePlot({
  width,
  height,
  entities,
  frames,
  position,
  limit,
  caption,
  fmt,
  title,
}: PlotProps) {
  const items = useMemo(() => raceItems(frames, position), [frames, position]);
  const max = visibleMax(items, limit) || 1;
  const left = Math.min(
    width * 0.34,
    Math.max(56, Math.max(...entities.map((entity) => estimateTextWidth(entity.name, 12))) + 12),
  );
  const right = 64;
  const innerWidth = Math.max(20, width - left - right);
  const rowHeight = Math.max(14, (height - 8) / limit);
  const barHeight = rowHeight * (1 - ROW_GAP);

  return (
    <svg
      role="img"
      aria-label={`${title}. ${caption}`}
      width={width}
      height={height}
      className="block overflow-visible"
    >
      <text
        x={width - 2}
        y={height - 6}
        textAnchor="end"
        className="pointer-events-none font-extrabold text-fs-440 tabular-nums"
        style={{ fill: "var(--ink-3)", fillOpacity: 0.22 }}
      >
        {caption}
      </text>
      <g transform={`translate(${left},4)`}>
        {items
          .filter((item) => item.rank < limit + 1)
          .map((item) => {
            const entity = entities[item.index] as BarRaceEntity;
            const y = item.rank * rowHeight + (rowHeight - barHeight) / 2;
            const length = Math.max(2, (item.value / max) * innerWidth);
            const fade = Math.min(1, Math.max(0, limit - item.rank));
            return (
              <g key={entity.id} transform={`translate(0,${y})`} style={{ opacity: fade }}>
                <rect
                  width={length}
                  height={barHeight}
                  rx={Math.min(6, barHeight / 2)}
                  style={{ fill: entity.color ?? seriesColor(item.index) }}
                />
                <text
                  x={-10}
                  y={barHeight / 2}
                  dy="0.34em"
                  textAnchor="end"
                  className="font-semibold text-fs-120"
                  style={{ fill: "var(--ink-2)" }}
                >
                  {entity.name}
                </text>
                <text
                  x={length + 8}
                  y={barHeight / 2}
                  dy="0.34em"
                  className="font-bold text-fs-110 tabular-nums"
                  style={{ fill: "var(--ink-2)" }}
                >
                  {fmt(item.value)}
                </text>
              </g>
            );
          })}
      </g>
    </svg>
  );
}
