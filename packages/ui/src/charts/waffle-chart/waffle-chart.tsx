"use client";

import { memo, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { CategorySlider, useCategoryExplorer } from "../core/category-explorer.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { popUnits, UNIT_FRAME_CLASS, UNIT_LEGEND_CLASS } from "../core/unit-glyph.js";
import type { UnitCategory } from "../core/unit-icons.js";
import { assignUnits, type GridOrder, gridCell, waffleCounts } from "../core/units.js";
import { useSeriesState } from "../core/use-series-state.js";

export type WaffleCellShape = "square" | "rounded" | "circle";

export interface WaffleChartProps {
  title: string;
  description?: string;
  data: readonly Omit<UnitCategory, "icon">[];
  rows?: number;
  columns?: number;
  /**
   * What the whole grid stands for. By default the categories fill every
   * cell; with a larger `total` the rest stays empty (62 of 100 chairs).
   */
  total?: number;
  cellShape?: WaffleCellShape;
  /** "row": left to right from the top; "column": bottom to top from the left. */
  order?: GridOrder;
  /** Gap between cells, as a fraction of the cell size. */
  gap?: number;
  height?: number;
  valueFormat?: ValueFormat;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

/**
 * Proportions as a grid of cells (10 x 10 by default, so one cell is 1%).
 * Cells are shared with the largest remainder method, so they always add up.
 * Hovering, focusing a legend item or moving with the arrows highlights one
 * category; hidden categories leave their cells empty.
 */
export function WaffleChart({
  title,
  description,
  data,
  rows = 10,
  columns = 10,
  total,
  cellShape = "rounded",
  order = "row",
  gap = 0.14,
  height = 260,
  valueFormat = "integer",
  legend = true,
  tooltip = true,
  animate = true,
  loading = false,
  initialHidden,
  labels: labelsProp,
  className,
}: WaffleChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const format = resolveFormat(valueFormat);
  const colors = data.map((item, index) => seriesColor(index, item.color));
  const sum = data.reduce((acc, item) => acc + Math.max(0, item.value), 0);
  const whole = total != null && total > sum ? total : sum;
  const cells = Math.max(1, Math.floor(rows)) * Math.max(1, Math.floor(columns));
  const counts = useMemo(
    () =>
      waffleCounts(
        data.map((item) => item.value),
        cells,
        total,
      ),
    [data, cells, total],
  );
  const empty = data.length === 0 || sum <= 0;
  const legendPlacement = legend === false ? null : legend === true ? "top" : legend;

  const legendItems: LegendItem[] = data.map((item, index) => ({
    id: item.id,
    name: item.name,
    color: colors[index] as string,
    shape: cellShape === "circle" ? "dot" : "square",
    hidden: state.isHidden(item.id),
  }));

  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="bars"
      legendPosition={legendPlacement ?? "top"}
      legend={
        legendPlacement ? (
          <ChartLegend
            items={legendItems}
            onToggle={state.toggle}
            onHighlight={state.setHighlighted}
            className={UNIT_LEGEND_CLASS}
          />
        ) : null
      }
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((item) => item.name)}
          columns={[
            { id: "value", name: title, values: data.map((item) => format(item.value)) },
            {
              id: "share",
              name: "%",
              values: data.map((item) => formatPercent(whole ? item.value / whole : 0)),
            },
          ]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width) => (
        <WafflePlot
          width={width}
          height={height}
          title={title}
          data={data}
          colors={colors}
          counts={counts}
          rows={Math.max(1, Math.floor(rows))}
          columns={Math.max(1, Math.floor(columns))}
          cellShape={cellShape}
          order={order}
          gap={gap}
          hidden={state.hidden}
          highlighted={state.highlighted}
          format={format}
          whole={whole}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface WafflePlotProps {
  width: number;
  height: number;
  title: string;
  data: readonly Omit<UnitCategory, "icon">[];
  colors: readonly string[];
  counts: readonly number[];
  rows: number;
  columns: number;
  cellShape: WaffleCellShape;
  order: GridOrder;
  gap: number;
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  format: (value: number) => string;
  whole: number;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

interface CellProps {
  x: number;
  y: number;
  size: number;
  shape: WaffleCellShape;
  color: string;
}

const Cell = memo(function Cell({ x, y, size, shape, color }: CellProps) {
  const style = { fill: color };
  return (
    <g data-unit="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      {shape === "circle" ? (
        <circle cx={x + size / 2} cy={y + size / 2} r={size / 2} style={style} />
      ) : (
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          rx={shape === "rounded" ? size * 0.28 : Math.min(2, size * 0.08)}
          style={style}
        />
      )}
    </g>
  );
});

function WafflePlot({
  width,
  height,
  title,
  data,
  colors,
  counts,
  rows,
  columns,
  cellShape,
  order,
  gap,
  hidden,
  highlighted,
  format,
  whole,
  tooltip,
  animate,
  labels,
}: WafflePlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const geometry = useMemo(() => {
    const across = columns + (columns - 1) * gap;
    const down = rows + (rows - 1) * gap;
    const size = Math.max(1, Math.min(width / across, height / down));
    const pitch = size * (1 + gap);
    const owners = assignUnits(counts);
    const cells = Array.from({ length: rows * columns }, (_, index) => {
      const { row, column } = gridCell(index, columns, rows, order);
      return { index, owner: owners[index] ?? -1, x: column * pitch, y: row * pitch };
    });
    const anchors = counts.map((_, category) => {
      const own = cells.filter((cell) => cell.owner === category);
      if (!own.length) return null;
      const xs = own.map((cell) => cell.x);
      const ys = own.map((cell) => cell.y);
      return { x: Math.max(...xs) + size, y: (Math.min(...ys) + Math.max(...ys) + size) / 2 };
    });
    return { size, cells, anchors };
  }, [width, height, rows, columns, gap, counts, order]);

  const explorer = useCategoryExplorer({
    count: data.length,
    isAvailable: (index) => {
      const item = data[index];
      return item != null && (counts[index] ?? 0) > 0 && !hidden.has(item.id);
    },
    anchor: (index) => geometry.anchors[index] ?? null,
  });

  useEntryAnimation(svgRef, (root) => popUnits(root, { duration: 360, budget: 700 }), {
    disabled: !animate,
    replayKey: `${rows}x${columns}-${data.length}`,
  });

  const activeItem = explorer.active == null ? null : data[explorer.active];
  const focusId = highlighted ?? activeItem?.id ?? null;
  const share = (value: number) => formatPercent(whole ? value / whole : 0);

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
        {...explorer.pointerProps}
      >
        <g>
          {geometry.cells
            .filter((cell) => cell.owner === -1 || hidden.has(data[cell.owner]?.id ?? ""))
            .map((cell) => (
              <Cell
                key={cell.index}
                x={cell.x}
                y={cell.y}
                size={geometry.size}
                shape={cellShape}
                color="var(--track)"
              />
            ))}
        </g>
        {data.map((item, category) => {
          if (hidden.has(item.id)) return null;
          const dimmed = focusId != null && focusId !== item.id;
          return (
            <g
              key={item.id}
              data-category={category}
              style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 160ms ease-out" }}
            >
              {geometry.cells
                .filter((cell) => cell.owner === category)
                .map((cell) => (
                  <Cell
                    key={cell.index}
                    x={cell.x}
                    y={cell.y}
                    size={geometry.size}
                    shape={cellShape}
                    color={colors[category] as string}
                  />
                ))}
            </g>
          );
        })}
      </svg>
      <CategorySlider
        explorer={explorer}
        label={labels.explore}
        count={data.length}
        valueText={
          activeItem
            ? `${activeItem.name}: ${format(activeItem.value)} (${share(activeItem.value)})`
            : title
        }
      />
      {tooltip && activeItem && explorer.position ? (
        <ChartTooltip
          x={explorer.position.x}
          y={explorer.position.y}
          containerWidth={width}
          rows={[
            {
              id: activeItem.id,
              name: activeItem.name,
              value: format(activeItem.value),
              color: colors[explorer.active as number] as string,
              shape: cellShape === "circle" ? "dot" : "square",
              note: share(activeItem.value),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
