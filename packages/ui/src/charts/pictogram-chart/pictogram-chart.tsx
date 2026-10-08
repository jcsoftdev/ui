"use client";

import { useId, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { CategorySlider, useCategoryExplorer } from "../core/category-explorer.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatNumber, formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { popUnits, UNIT_FRAME_CLASS, UNIT_LEGEND_CLASS, UnitGlyph } from "../core/unit-glyph.js";
import {
  type ResolvedUnitShape,
  resolveUnitShape,
  type UnitCategory,
  type UnitIcon,
} from "../core/unit-icons.js";
import { fitUnitGrid, unitCount, unitFractions } from "../core/units.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface PictogramChartProps {
  title: string;
  description?: string;
  data: readonly UnitCategory[];
  /** Value one icon stands for. The last icon of a category is clipped to its remainder. */
  perUnit?: number;
  /** Built-in icon name, a 24 x 24 path, or a `UnitShape`. */
  icon?: UnitIcon;
  /** "grid": categories flow one after the other; "rows": each category starts a new row. */
  layout?: "grid" | "rows";
  /** Fixed number of columns; by default the largest icons that fit the box decide. */
  columns?: number;
  /** Capacity drawn as empty icons after the data (grid layout), e.g. 120 seats a day. */
  total?: number;
  /** Largest icon side in pixels. */
  unitSize?: number;
  /** Gap between icons, as a fraction of the icon size. */
  gap?: number;
  height?: number;
  valueFormat?: ValueFormat;
  /** What the values count, for the key and the tooltip ("clientes"). */
  unitLabel?: string;
  /** Shows "icon = N unitLabel" under the chart. Defaults to on when `perUnit` is not 1. */
  showKey?: boolean;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

/** Neutral key mark when categories wear different icons. */
const MIXED_KEY = "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z";

interface Placed {
  key: string;
  category: number;
  fill: number;
  x: number;
  y: number;
  shape: ResolvedUnitShape;
}

/**
 * Isotype pictogram: every icon stands for `perUnit` of something (clients,
 * services, bottles) and the last icon of a category is cut to its remainder.
 * Icons grow to the largest size that fits the box, up to `unitSize`.
 */
export function PictogramChart({
  title,
  description,
  data,
  perUnit = 1,
  icon = "person",
  layout = "grid",
  columns,
  total,
  unitSize = 32,
  gap = 0.25,
  height = 200,
  valueFormat = "integer",
  unitLabel = "units",
  showKey,
  legend = true,
  tooltip = true,
  animate = true,
  loading = false,
  initialHidden,
  labels: labelsProp,
  className,
}: PictogramChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const format = resolveFormat(valueFormat);
  const colors = data.map((item, index) => seriesColor(index, item.color));
  const sum = data.reduce((acc, item) => acc + Math.max(0, item.value), 0);
  const empty = data.length === 0 || sum <= 0;
  const keyShown = showKey ?? perUnit !== 1;
  const legendPlacement = legend === false ? null : legend === true ? "top" : legend;

  const legendItems: LegendItem[] = data.map((item, index) => ({
    id: item.id,
    name: item.name,
    color: colors[index] as string,
    shape: "dot",
    hidden: state.isHidden(item.id),
  }));

  const icons = new Set(data.map((item) => item.icon ?? icon));
  const keyShape = resolveUnitShape(icons.size > 1 ? MIXED_KEY : icon);
  const footer = keyShown ? (
    <p className="m-0 flex items-center gap-1.5 text-[12px] text-ink-3">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
        <path d={keyShape.path} style={{ fill: "var(--ink-3)", fillRule: keyShape.fillRule }} />
      </svg>
      <span>
        = {formatNumber(perUnit)} {unitLabel}
      </span>
    </p>
  ) : null;

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
      footer={footer}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((item) => item.name)}
          columns={[
            { id: "value", name: unitLabel, values: data.map((item) => format(item.value)) },
            {
              id: "units",
              name: `÷ ${formatNumber(perUnit)}`,
              values: data.map((item) =>
                formatNumber(item.value / perUnit, { maximumFractionDigits: 1 }),
              ),
            },
          ]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width) => (
        <PictogramPlot
          width={width}
          height={height}
          title={title}
          data={data}
          colors={colors}
          hidden={state.hidden}
          highlighted={state.highlighted}
          perUnit={perUnit}
          icon={icon}
          layout={layout}
          columns={columns}
          total={total}
          unitSize={unitSize}
          gap={gap}
          format={format}
          sum={sum}
          unitLabel={unitLabel}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface PictogramPlotProps {
  width: number;
  height: number;
  title: string;
  data: readonly UnitCategory[];
  colors: readonly string[];
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  perUnit: number;
  icon: UnitIcon;
  layout: "grid" | "rows";
  columns?: number;
  total?: number;
  unitSize: number;
  gap: number;
  format: (value: number) => string;
  sum: number;
  unitLabel: string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

function PictogramPlot({
  width,
  height,
  title,
  data,
  colors,
  hidden,
  highlighted,
  perUnit,
  icon,
  layout,
  columns,
  total,
  unitSize,
  gap,
  format,
  sum,
  unitLabel,
  tooltip,
  animate,
  labels,
}: PictogramPlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);

  const geometry = useMemo(() => {
    const runs = data.map((item) => unitFractions(item.value, perUnit));
    const used = runs.reduce((acc, run) => acc + run.length, 0);
    const spare =
      layout === "grid" && total != null ? Math.max(0, unitCount(total, perUnit).units - used) : 0;
    const count = used + spare;
    const rowsFor =
      layout === "rows"
        ? (cols: number) => runs.reduce((acc, run) => acc + Math.ceil(run.length / cols), 0)
        : (cols: number) => Math.ceil(count / cols);
    const maxColumns =
      layout === "rows" ? Math.max(1, ...runs.map((run) => run.length)) : Math.max(1, count);
    const fit = fitUnitGrid({
      width,
      height,
      gap,
      maxSize: unitSize,
      maxColumns,
      rowsFor,
      columns,
    });
    const pitch = fit.size * (1 + gap);
    const units: Placed[] = [];
    let slot = 0;
    let row = 0;
    const place = (category: number, fill: number, shape: ResolvedUnitShape, index: number) => {
      const column = layout === "rows" ? index % fit.columns : slot % fit.columns;
      const line =
        layout === "rows" ? row + Math.floor(index / fit.columns) : Math.floor(slot / fit.columns);
      units.push({
        key: `${category}-${index}`,
        category,
        fill,
        x: column * pitch,
        y: line * pitch,
        shape,
      });
      slot += 1;
    };
    runs.forEach((run, category) => {
      const shape = resolveUnitShape(data[category]?.icon ?? icon);
      run.forEach((fill, index) => {
        place(category, fill, shape, index);
      });
      if (layout === "rows") row += Math.ceil(run.length / fit.columns);
    });
    const spareShape = resolveUnitShape(icon);
    for (let index = 0; index < spare; index += 1) place(-1, 0, spareShape, used + index);
    const anchors = runs.map((_, category) => {
      const own = units.filter((unit) => unit.category === category);
      if (!own.length) return null;
      const last = own[own.length - 1] as Placed;
      return { x: last.x + fit.size, y: last.y + fit.size / 2 };
    });
    return { units, size: fit.size, anchors };
  }, [data, perUnit, icon, layout, columns, total, unitSize, gap, width, height]);

  const explorer = useCategoryExplorer({
    count: data.length,
    isAvailable: (index) => {
      const item = data[index];
      return item != null && item.value > 0 && !hidden.has(item.id);
    },
    anchor: (index) => geometry.anchors[index] ?? null,
  });

  useEntryAnimation(svgRef, (root) => popUnits(root), {
    disabled: !animate,
    replayKey: `${data.length}-${perUnit}-${layout}`,
  });

  const activeItem = explorer.active == null ? null : data[explorer.active];
  const focusId = highlighted ?? activeItem?.id ?? null;
  const describe = (index: number) => {
    const item = data[index] as UnitCategory;
    return `${item.name}: ${format(item.value)} (${formatPercent(sum ? item.value / sum : 0)})`;
  };

  const byCategory = data.map((_, category) =>
    geometry.units.filter((unit) => unit.category === category),
  );
  const spare = geometry.units.filter((unit) => unit.category === -1);

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
        {byCategory.map((units, category) => {
          const item = data[category] as UnitCategory;
          const off = hidden.has(item.id);
          const dimmed = focusId != null && focusId !== item.id;
          return (
            <g
              key={item.id}
              data-category={off ? undefined : category}
              style={{ opacity: dimmed ? 0.22 : 1, transition: "opacity 160ms ease-out" }}
            >
              {units.map((unit) => (
                <UnitGlyph
                  key={unit.key}
                  shape={unit.shape}
                  x={unit.x}
                  y={unit.y}
                  size={geometry.size}
                  fill={off ? 0 : unit.fill}
                  color={colors[category] as string}
                  clipId={`${uid}-${unit.key}`}
                />
              ))}
            </g>
          );
        })}
        {spare.length ? (
          <g style={{ opacity: focusId != null ? 0.5 : 1, transition: "opacity 160ms ease-out" }}>
            {spare.map((unit) => (
              <UnitGlyph
                key={unit.key}
                shape={unit.shape}
                x={unit.x}
                y={unit.y}
                size={geometry.size}
                fill={0}
                color="var(--track)"
                clipId={`${uid}-${unit.key}`}
              />
            ))}
          </g>
        ) : null}
      </svg>
      <CategorySlider
        explorer={explorer}
        label={labels.explore}
        count={data.length}
        valueText={explorer.active == null ? title : describe(explorer.active)}
      />
      {tooltip && activeItem && explorer.position ? (
        <ChartTooltip
          x={explorer.position.x}
          y={explorer.position.y}
          containerWidth={width}
          title={activeItem.name}
          rows={[
            {
              id: activeItem.id,
              name: unitLabel,
              value: format(activeItem.value),
              color: colors[explorer.active as number] as string,
              note: formatPercent(sum ? activeItem.value / sum : 0),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
