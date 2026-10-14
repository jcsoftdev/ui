"use client";

import { memo, useMemo, useRef, useState } from "react";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { type Chord, chordLayout, chordsOf, ribbonPath } from "../core/chord.js";
import { ChartDataTable } from "../core/data-table.js";
import { DEFAULT_EXPORT_TEXTS, ExportMenu, type ExportTexts } from "../core/export-menu.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import { useLeaveGrace } from "../core/leave-grace.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { arcPath, degToRad, polarPoint } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, DEFAULT_LABELS } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";

export interface ChordGroupInput {
  id: string;
  name: string;
  /** CSS color; defaults to a palette slot. */
  color?: string;
}

/** Visible strings of the chord chart. */
export interface ChordLabels extends ChartLabels {
  /** Data table header of the row (where a flow starts). */
  from: string;
  to: string;
  /** Tooltip row: everything entering a group. */
  inflow: string;
  /** Tooltip row: everything leaving a group. */
  outflow: string;
  exportTexts: ExportTexts;
}

export const DEFAULT_CHORD_LABELS: ChordLabels = {
  ...DEFAULT_LABELS,
  explore:
    "Chord diagram. Left and right arrows move between groups, Escape clears. Ribbons show the flows between groups.",
  category: "From",
  from: "From",
  to: "To",
  inflow: "In",
  outflow: "Out",
  exportTexts: DEFAULT_EXPORT_TEXTS,
};

export interface ChordChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  description?: string;
  groups: readonly ChordGroupInput[];
  /** `matrix[i][j]`: flow from group `i` to group `j`. A group's arc spans its row sum. */
  matrix: ReadonlyArray<readonly number[]>;
  /** Gap between groups, in degrees. */
  padAngle?: number;
  /** Where the first group starts, degrees from twelve o'clock. */
  startAngle?: number;
  /** Thickness of the group ring as a fraction of the radius. */
  ringWidth?: number;
  sortGroups?: "input" | "ascending" | "descending";
  /** Order of the ribbon ends inside a group. */
  sortSubgroups?: "input" | "ascending" | "descending";
  /** Group names around the ring (hidden automatically in narrow containers). */
  showLabels?: boolean;
  valueFormat?: ValueFormat;
  height?: number | "fill";
  /** Width / height ratio of the drawing; ignored with `"fill"`. */
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  /** SVG and PNG export buttons. */
  exportable?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<ChordLabels>;
  onGroupClick?: (group: ChordGroupInput, index: number) => void;
  className?: string;
}

const RIM_GAP = 8;

/**
 * Chord diagram: groups share a circle, ribbons between them are the flows
 * (who switches to whom, which service goes with which). Hover a group to
 * light its ribbons, a ribbon to isolate it; arrows walk the groups.
 */
export function ChordChart({
  title,
  description,
  groups,
  matrix,
  padAngle = 3,
  startAngle = 0,
  ringWidth = 0.09,
  sortGroups = "input",
  sortSubgroups = "descending",
  showLabels = true,
  valueFormat,
  height = 420,
  aspectRatio,
  legend = true,
  tooltip = true,
  exportable = false,
  animate = true,
  loading,
  labels: labelsProp,
  onGroupClick,
  className,
}: ChordChartProps) {
  const labels = useMemo(
    () => (labelsProp ? { ...DEFAULT_CHORD_LABELS, ...labelsProp } : DEFAULT_CHORD_LABELS),
    [labelsProp],
  );
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const layout = useMemo(
    () =>
      chordLayout(matrix, {
        padAngle: degToRad(padAngle),
        startAngle: degToRad(startAngle),
        sortGroups,
        sortSubgroups,
      }),
    [matrix, padAngle, startAngle, sortGroups, sortSubgroups],
  );
  const colors = useMemo(
    () => groups.map((group, index) => seriesColor(index, group.color)),
    [groups],
  );
  const empty = layout.groups.length === 0;

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="ring"
      className={className}
      legend={
        legend || exportable ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {legend ? (
              <ChartLegend
                items={groups.map((group, index) => ({
                  id: group.id,
                  name: group.name,
                  color: colors[index] as string,
                  shape: "dot",
                }))}
              />
            ) : (
              <span />
            )}
            {exportable ? (
              <ExportMenu
                title={title}
                texts={labels.exportTexts}
                getSvgs={(root) =>
                  Array.from(
                    root
                      .closest('[class~="@container/chart"]')
                      ?.querySelectorAll<SVGSVGElement>("svg[data-export-part]") ?? [],
                  )
                }
              />
            ) : null}
          </div>
        ) : undefined
      }
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.from}
          categories={groups.map((group) => group.name)}
          columns={groups.map((group, j) => ({
            id: group.id,
            name: `${labels.to} ${group.name}`,
            values: groups.map((_, i) => format(matrix[i]?.[j] ?? 0)),
          }))}
        />
      }
    >
      {(width, drawingHeight) => (
        <ChordPlot
          title={title}
          groups={groups}
          matrix={matrix}
          layout={layout}
          colors={colors}
          ringWidth={ringWidth}
          showLabels={showLabels}
          format={format}
          labels={labels}
          tooltip={tooltip}
          animate={animate}
          onGroupClick={onGroupClick}
          width={width}
          height={drawingHeight}
        />
      )}
    </ChartFrame>
  );
}

type Focus = { kind: "group"; index: number } | { kind: "chord"; key: string };

const chordKey = (chord: Chord) => `${chord.source.index}:${chord.target.index}`;

interface PlotProps {
  title: string;
  groups: readonly ChordGroupInput[];
  matrix: ReadonlyArray<readonly number[]>;
  layout: ReturnType<typeof chordLayout>;
  colors: readonly string[];
  ringWidth: number;
  showLabels: boolean;
  format: ValueFormatter;
  labels: ChordLabels;
  tooltip: boolean;
  animate: boolean;
  onGroupClick?: ChordChartProps["onGroupClick"];
  width: number;
  height: number;
}

function ChordPlot({
  title,
  groups,
  matrix,
  layout,
  colors,
  ringWidth,
  showLabels,
  format,
  labels,
  tooltip,
  animate,
  onGroupClick,
  width,
  height,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const order = useMemo(
    () => [...layout.groups].sort((a, b) => a.startAngle - b.startAngle),
    [layout.groups],
  );
  const nav = useIndexNavigation(order.length, { wrap: true });
  const [hover, setHover] = useState<{ focus: Focus; x: number; y: number } | null>(null);
  const { leave: leaveSoon, hold } = useLeaveGrace(() => setHover(null));
  const showHover = (next: { focus: Focus; x: number; y: number }) => {
    hold();
    setHover(next);
  };

  const rim = showLabels && width >= 420;
  const labelRoom = rim
    ? Math.min(
        width * 0.28,
        Math.max(...groups.map((group) => estimateTextWidth(group.name, 11.5))) + RIM_GAP + 6,
      )
    : 0;
  const radius = Math.max(40, Math.min(width / 2 - labelRoom - 4, height / 2 - (rim ? 16 : 4)));
  const inner = radius * (1 - Math.min(0.4, Math.max(0.03, ringWidth)));
  const cx = width / 2;
  const cy = height / 2;

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-ribbon]").forEach((node, i) => {
        fadeIn(node, 500, i * 25);
      });
      root.querySelectorAll("[data-arc]").forEach((node, i) => {
        node.animate(
          [
            { opacity: 0, transform: "scale(.9)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 520, delay: i * 50, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: layout.chords.length * 100 + layout.groups.length },
  );

  const keyboardGroup = nav.active != null ? (order[nav.active]?.index ?? null) : null;
  const focus: Focus | null =
    hover?.focus ?? (keyboardGroup != null ? { kind: "group", index: keyboardGroup } : null);
  const lit = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === "group") {
      return new Set(chordsOf(layout, focus.index).map(chordKey));
    }
    return new Set([focus.key]);
  }, [focus, layout]);
  const litGroups = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === "group") {
      const set = new Set([focus.index]);
      for (const chord of chordsOf(layout, focus.index)) {
        set.add(chord.source.index);
        set.add(chord.target.index);
      }
      return set;
    }
    const chord = layout.chords.find((candidate) => chordKey(candidate) === focus.key);
    return chord ? new Set([chord.source.index, chord.target.index]) : null;
  }, [focus, layout]);

  const point = (event: { clientX: number; clientY: number }) => {
    const box = svgRef.current?.getBoundingClientRect();
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : { x: 0, y: 0 };
  };

  const inflow = (index: number) =>
    matrix.reduce((sum, row, i) => sum + (i === index ? 0 : (row[index] ?? 0)), 0) +
    (matrix[index]?.[index] ?? 0);

  const tip = ((): { title: string; rows: TooltipRow[]; x: number; y: number } | null => {
    if (!focus) return null;
    const anchor = hover
      ? { x: hover.x, y: hover.y }
      : focus.kind === "group"
        ? (() => {
            const group = layout.groups.find((g) => g.index === focus.index);
            return group
              ? polarPoint(cx, cy, inner, (group.startAngle + group.endAngle) / 2)
              : { x: cx, y: cy };
          })()
        : { x: cx, y: cy };
    if (focus.kind === "group") {
      const group = groups[focus.index];
      if (!group) return null;
      const rows: TooltipRow[] = [
        {
          id: "out",
          name: labels.outflow,
          value: format(layout.groups.find((g) => g.index === focus.index)?.value ?? 0),
          color: colors[focus.index] as string,
          shape: "dot",
        },
        {
          id: "in",
          name: labels.inflow,
          value: format(inflow(focus.index)),
          color: "transparent",
        },
      ];
      const flows = (matrix[focus.index] ?? [])
        .map((value, j) => ({ value, j }))
        .filter(({ value, j }) => value > 0 && j !== focus.index)
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);
      for (const { value, j } of flows) {
        rows.push({
          id: `to-${j}`,
          name: `→ ${groups[j]?.name ?? j}`,
          value: format(value),
          color: colors[j] as string,
          shape: "dot",
        });
      }
      return { title: group.name, rows, ...anchor };
    }
    const chord = layout.chords.find((candidate) => chordKey(candidate) === focus.key);
    if (!chord) return null;
    const a = chord.source.index;
    const b = chord.target.index;
    const rows: TooltipRow[] = [
      {
        id: "ab",
        name: `${groups[a]?.name} → ${groups[b]?.name}`,
        value: format(matrix[a]?.[b] ?? 0),
        color: colors[a] as string,
        shape: "dot",
      },
    ];
    if (a !== b) {
      rows.push({
        id: "ba",
        name: `${groups[b]?.name} → ${groups[a]?.name}`,
        value: format(matrix[b]?.[a] ?? 0),
        color: colors[b] as string,
        shape: "dot",
      });
    }
    return { title: `${groups[a]?.name} ↔ ${groups[b]?.name}`, rows, ...anchor };
  })();

  const valueText = (() => {
    const group = keyboardGroup != null ? groups[keyboardGroup] : null;
    if (!group || keyboardGroup == null) return title;
    const out = layout.groups.find((g) => g.index === keyboardGroup)?.value ?? 0;
    const flows = (matrix[keyboardGroup] ?? [])
      .map((value, j) => ({ value, j }))
      .filter(({ value, j }) => value > 0 && j !== keyboardGroup)
      .sort((a, b) => b.value - a.value)
      .map(({ value, j }) => `${groups[j]?.name} ${format(value)}`);
    return `${group.name}: ${labels.outflow} ${format(out)}, ${labels.inflow} ${format(inflow(keyboardGroup))}. ${flows.join(", ")}`;
  })();

  return (
    <div ref={nav.ref} className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        data-export-part=""
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g transform={`translate(${cx},${cy})`}>
          <ChordRibbons
            chords={layout.chords}
            radius={inner - 2}
            colors={colors}
            lit={lit}
            onEnter={(chord, event) =>
              showHover({ focus: { kind: "chord", key: chordKey(chord) }, ...point(event) })
            }
            onLeave={leaveSoon}
          />
          {layout.groups.map((group) => {
            const dim = litGroups ? !litGroups.has(group.index) : false;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; keyboard users explore through the slider.
              <path
                key={group.index}
                data-arc=""
                d={arcPath({
                  cx: 0,
                  cy: 0,
                  innerRadius: inner,
                  outerRadius: radius,
                  startAngle: group.startAngle,
                  endAngle: group.endAngle,
                  cornerRadius: 3,
                })}
                data-chart-hit=""
                className={onGroupClick ? "cursor-pointer" : "cursor-default"}
                style={{
                  fill: colors[group.index],
                  opacity: dim ? 0.3 : 1,
                  transition: "opacity 150ms",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
                onPointerEnter={(event) =>
                  showHover({ focus: { kind: "group", index: group.index }, ...point(event) })
                }
                onPointerMove={(event) =>
                  showHover({ focus: { kind: "group", index: group.index }, ...point(event) })
                }
                onPointerLeave={leaveSoon}
                onClick={() => {
                  const input = groups[group.index];
                  if (input) onGroupClick?.(input, group.index);
                }}
              />
            );
          })}
          {rim
            ? layout.groups.map((group) => {
                const mid = (group.startAngle + group.endAngle) / 2;
                const at = polarPoint(0, 0, radius + RIM_GAP, mid);
                const sin = Math.sin(mid);
                const cos = Math.cos(mid);
                const dim = litGroups ? !litGroups.has(group.index) : false;
                return (
                  <text
                    key={group.index}
                    {...DECORATIVE}
                    x={at.x}
                    y={at.y + (cos > 0.4 ? -2 : cos < -0.4 ? 10 : 4)}
                    textAnchor={sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle"}
                    className="pointer-events-none select-none fill-ink-2 font-semibold text-fs-115"
                    style={{ opacity: dim ? 0.4 : 1, transition: "opacity 150ms" }}
                  >
                    {groups[group.index]?.name}
                  </text>
                );
              })
            : null}
        </g>
      </svg>

      <div
        role="slider"
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, order.length)}
        aria-valuenow={(nav.active ?? 0) + 1}
        aria-valuetext={valueText}
        tabIndex={0}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      />

      {tooltip && tip && tip.rows.length > 0 ? (
        <ChartTooltip
          x={tip.x}
          y={tip.y}
          containerWidth={width}
          title={tip.title}
          rows={tip.rows}
        />
      ) : null}
    </div>
  );
}

const ChordRibbons = memo(function ChordRibbons({
  chords,
  radius,
  colors,
  lit,
  onEnter,
  onLeave,
}: {
  chords: readonly Chord[];
  radius: number;
  colors: readonly string[];
  lit: ReadonlySet<string> | null;
  onEnter: (chord: Chord, event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
}) {
  return (
    <g>
      {chords.map((chord) => {
        const on = lit ? lit.has(chordKey(chord)) : null;
        return (
          <path
            key={chordKey(chord)}
            data-ribbon=""
            data-chart-hit=""
            d={ribbonPath(chord, radius)}
            className="motion-safe:transition-[fill-opacity] motion-safe:duration-150"
            style={{
              fill: colors[chord.source.index],
              fillOpacity: on === null ? 0.5 : on ? 0.8 : 0.07,
              stroke: colors[chord.source.index],
              strokeOpacity: on === null ? 0.25 : on ? 0.7 : 0.05,
              strokeWidth: 0.75,
            }}
            onPointerEnter={(event) => onEnter(chord, event)}
            onPointerMove={(event) => onEnter(chord, event)}
            onPointerLeave={onLeave}
          />
        );
      })}
    </g>
  );
});
