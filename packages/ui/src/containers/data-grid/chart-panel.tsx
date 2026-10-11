"use client";

import { useMemo } from "react";
import { AreaChart } from "../../charts/area-chart/area-chart.js";
import { BarChart } from "../../charts/bar-chart/bar-chart.js";
import type { ValueFormat } from "../../charts/core/format.js";
import { LineChart } from "../../charts/line-chart/line-chart.js";
import { PieChart } from "../../charts/pie-chart/pie-chart.js";
import { BarChart2, X } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import {
  availableKinds,
  type GridChartKind,
  pieSlices,
  type RangeChartData,
} from "./chart-range.js";

export interface ChartPanelLabels {
  title: string;
  kinds: Record<GridChartKind, string>;
  kindGroup: string;
  close: string;
  noData: string;
  other: string;
}

export interface ChartPanelProps {
  /** Null when the range holds no numbers. */
  data: RangeChartData | null;
  kind: GridChartKind;
  onKind: (kind: GridChartKind) => void;
  onClose: () => void;
  valueFormat: ValueFormat;
  labels: ChartPanelLabels;
  /** Height of the drawing in px. */
  height?: number;
  className?: string;
}

const buttonClass =
  "inline-flex h-7 items-center rounded-xs px-2 font-[600] text-fs-120 text-ink-3 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-ink";

/** Chart drawn from a range of grid cells: bars, lines, areas or a pie. Loaded on demand by the grid. */
export function ChartPanel({
  data,
  kind,
  onKind,
  onClose,
  valueFormat,
  labels,
  height = 260,
  className,
}: ChartPanelProps) {
  const kinds = useMemo(() => (data ? availableKinds(data) : []), [data]);
  const shown = kinds.includes(kind) ? kind : "bar";
  const slices = useMemo(
    () => (data && shown === "pie" ? pieSlices(data, 0, 8, labels.other) : []),
    [data, shown, labels.other],
  );

  return (
    <section
      aria-label={labels.title}
      className={cn("@container/gridchart min-w-0 border-t-divider", className)}
    >
      <header className="flex flex-wrap items-center gap-2 px-3 pt-2">
        <BarChart2 aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
        <h3 className="mr-auto min-w-0 truncate font-[650] text-fs-130 text-ink">{labels.title}</h3>
        {data ? (
          <fieldset className="flex h-control-sm items-center rounded-control border-divider bg-surface-control p-0.5">
            <legend className="sr-only">{labels.kindGroup}</legend>
            {kinds.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={shown === option}
                onClick={() => onKind(option)}
                className={buttonClass}
              >
                {labels.kinds[option]}
              </button>
            ))}
          </fieldset>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          title={labels.close}
          className="grid size-7 place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink [&_svg]:size-4"
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {data ? (
        <div className="min-w-0 p-3" style={{ height: height + 24 }}>
          {shown === "pie" ? (
            <PieChart
              title={labels.title}
              data={slices.map((slice) => ({ id: slice.id, name: slice.name, value: slice.value }))}
              height="fill"
              valueFormat={valueFormat}
              legend="bottom"
              animate={false}
            />
          ) : shown === "bar" ? (
            <BarChart
              title={labels.title}
              categories={data.categories}
              series={data.series}
              height="fill"
              valueFormat={valueFormat}
              animate={false}
            />
          ) : shown === "line" ? (
            <LineChart
              title={labels.title}
              categories={data.categories}
              series={data.series}
              height="fill"
              valueFormat={valueFormat}
              markers
              animate={false}
            />
          ) : (
            <AreaChart
              title={labels.title}
              categories={data.categories}
              series={data.series}
              height="fill"
              valueFormat={valueFormat}
              animate={false}
            />
          )}
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-fs-130 text-ink-3">{labels.noData}</p>
      )}
    </section>
  );
}
