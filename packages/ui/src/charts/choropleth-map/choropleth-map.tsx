"use client";

import { useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import type { ColorRange, ScaleColors } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartTooltip } from "../core/tooltip.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { heatmapScale } from "../heatmap-chart/heatmap-scale.js";
import { type MapDataRow, MapDataTable } from "../maps/geo/map-data-table.js";
import { type MapLabels, resolveMapLabels } from "../maps/geo/map-labels.js";
import { MapLegend } from "../maps/geo/map-legend.js";
import { MapViewport } from "../maps/geo/map-viewport.js";
import { createRegionIndex } from "../maps/geo/match.js";
import type { GeoMap, ProjectionKind } from "../maps/geo/types.js";
import { defaultMapHeight, useMapGeometry } from "../maps/geo/use-map-geometry.js";
import { useMapView } from "../maps/geo/use-map-view.js";

export interface ChoroplethDatum {
  /** Region id (e.g. "PE-CUS") or its name ("Cusco"); accents and case are ignored. */
  id: string;
  /** `null` leaves the region without data. */
  value: number | null;
}

export interface ChoroplethRegionInfo {
  index: number;
  id: string;
  name: string;
  value: number | null;
}

export interface ChoroplethMapProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Geometry to draw, e.g. `peruMap` from `@jcsoftdev/ui/charts/maps/data/peru`. */
  map: GeoMap;
  data: readonly ChoroplethDatum[];
  /** "sequential" (empty to brand) or "diverging" (low hue, neutral at `center`, brand). */
  scale?: "sequential" | "diverging";
  /** Fixed [min, max] of the color scale; the data extent by default. */
  domain?: readonly [number, number];
  /** Neutral value of a diverging scale. */
  center?: number;
  colors?: ScaleColors;
  /** Stepped (threshold) coloring; replaces the continuous scale. */
  ranges?: readonly ColorRange[];
  valueFormat?: ValueFormat;
  /** Name of the value in the tooltip and the data table, e.g. "Clientes". */
  valueName?: string;
  /** Overrides the projection of the map. */
  projection?: ProjectionKind;
  /** Text drawn on each region where it fits: its name or its value. */
  regionLabels?: "none" | "name" | "value";
  /** Height in px, "fill" or the default (half of the width, at least 220). */
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width. */
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  /**
   * The numbers as a real table, the accessible alternative to color: "hidden" (default, for
   * screen readers only), "visible" (replaces the map) or "toggle" (a button switches between
   * the map and the table).
   */
  dataTable?: "hidden" | "visible" | "toggle";
  /** Zoom buttons, wheel, drag and pinch. */
  zoomable?: boolean;
  /** "modifier": the wheel only zooms with Ctrl or Cmd held, so page scrolling is never trapped. */
  wheelZoom?: "always" | "modifier";
  maxZoom?: number;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<MapLabels>;
  onRegionClick?: (region: ChoroplethRegionInfo) => void;
  className?: string;
}

const NO_DATA_FILL = "var(--surface-2)";

/**
 * Regions colored by value: customers by department, sales by country.
 * Sequential, diverging or threshold scales come from tokens, so the map
 * follows the theme and accent. Hover or arrow keys highlight a region and
 * show its value; click or Enter calls `onRegionClick`; zoom with the
 * buttons, wheel, pinch or `+` / `-`, drag to pan, `0` to fit.
 */
export function ChoroplethMap({
  title,
  map,
  data,
  scale = "sequential",
  domain,
  center = 0,
  colors,
  ranges,
  valueFormat,
  valueName,
  projection,
  regionLabels = "none",
  dataTable = "hidden",
  height,
  aspectRatio,
  legend = true,
  tooltip = true,
  zoomable = true,
  wheelZoom = "modifier",
  maxZoom = 16,
  animate = true,
  loading,
  labels: labelsProp,
  onRegionClick,
  className,
}: ChoroplethMapProps) {
  const labels = resolveMapLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const lookup = useMemo(() => createRegionIndex(data), [data]);
  const finite = useMemo(
    () =>
      data.flatMap((datum) =>
        typeof datum.value === "number" && Number.isFinite(datum.value) ? [datum.value] : [],
      ),
    [data],
  );
  const colorScale = useMemo(
    () => heatmapScale(finite, { scale, domain, center, colors, ranges }),
    [finite, scale, domain, center, colors, ranges],
  );
  const name = valueName ?? labels.value;
  const [tableOpen, setTableOpen] = useState(false);
  const showTable = dataTable === "visible" || (dataTable === "toggle" && tableOpen);
  const rows = useMemo<MapDataRow[]>(
    () =>
      (map.topology.objects[map.object]?.geometries ?? []).map((region) => {
        const regionName = region.properties?.name ?? region.id ?? "";
        const value = lookup({ id: region.id ?? "", name: regionName })?.value ?? null;
        return {
          id: region.id ?? regionName,
          name: regionName,
          value,
          display: value == null ? "" : format(value),
          color: value == null ? NO_DATA_FILL : (colorScale.color(value)?.color ?? NO_DATA_FILL),
        };
      }),
    [map, lookup, format, colorScale],
  );

  return (
    <ChartFrame
      height={height ?? ((width) => defaultMapHeight(map, width, projection))}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={finite.length === 0}
      skeleton="bars"
      className={className}
      legend={
        dataTable === "toggle" ? (
          <button
            type="button"
            aria-pressed={tableOpen}
            onClick={() => setTableOpen((open) => !open)}
            className={cn(
              "cursor-pointer rounded-button border-0 px-3 py-1 font-semibold text-fs-120 outline-none focus-visible:outline-2 focus-visible:outline-accent-ink",
              tableOpen ? "bg-surface-2 text-ink" : "bg-surface-2 text-ink-3 hover:text-ink",
            )}
          >
            {tableOpen ? labels.showMap : labels.showTable}
          </button>
        ) : null
      }
      footer={
        legend ? (
          <MapLegend
            kind={scale}
            domain={colorScale.domain}
            center={center}
            colors={colors}
            ranges={ranges}
            format={format}
            noData={data.length > finite.length ? labels.noData : undefined}
          />
        ) : null
      }
      table={
        showTable ? null : (
          <ChoroplethTable
            title={title}
            map={map}
            lookup={lookup}
            format={format}
            valueName={name}
            labels={labels}
          />
        )
      }
    >
      {(width, drawingHeight) =>
        showTable ? (
          <MapDataTable
            caption={title}
            rows={rows}
            valueName={name}
            labels={labels}
            height={drawingHeight}
            onRowClick={
              onRegionClick
                ? (row) => {
                    const index = rows.findIndex((candidate) => candidate.id === row.id);
                    onRegionClick({ index, id: row.id, name: row.name, value: row.value });
                  }
                : undefined
            }
          />
        ) : (
          <ChoroplethPlot
            width={width}
            height={drawingHeight}
            title={title}
            map={map}
            lookup={lookup}
            colorScale={colorScale}
            format={format}
            valueName={name}
            projection={projection}
            regionLabels={regionLabels}
            tooltip={tooltip}
            zoomable={zoomable}
            wheelZoom={wheelZoom}
            maxZoom={maxZoom}
            animate={animate}
            labels={labels}
            onRegionClick={onRegionClick}
          />
        )
      }
    </ChartFrame>
  );
}

type Lookup = (feature: { id: string; name: string }) => ChoroplethDatum | undefined;

function ChoroplethTable({
  title,
  map,
  lookup,
  format,
  valueName,
  labels,
}: {
  title: string;
  map: GeoMap;
  lookup: Lookup;
  format: (value: number) => string;
  valueName: string;
  labels: MapLabels;
}) {
  const geometry = useMemo(() => map.topology.objects[map.object]?.geometries ?? [], [map]);
  const rows = geometry.map((region) => {
    const datum = lookup({ id: region.id ?? "", name: region.properties?.name ?? "" });
    return {
      name: region.properties?.name ?? region.id ?? "",
      value: datum?.value == null ? labels.noData : format(datum.value),
    };
  });
  return (
    <ChartDataTable
      caption={title}
      categoryHeader={labels.region}
      categories={rows.map((row) => row.name)}
      columns={[{ id: "value", name: valueName, values: rows.map((row) => row.value) }]}
    />
  );
}

function ChoroplethPlot({
  width,
  height,
  title,
  map,
  lookup,
  colorScale,
  format,
  valueName,
  projection,
  regionLabels,
  tooltip,
  zoomable,
  wheelZoom,
  maxZoom,
  animate,
  labels,
  onRegionClick,
}: {
  width: number;
  height: number;
  title: string;
  map: GeoMap;
  lookup: Lookup;
  colorScale: ReturnType<typeof heatmapScale>;
  format: (value: number) => string;
  valueName: string;
  projection?: ProjectionKind;
  regionLabels: "none" | "name" | "value";
  tooltip: boolean;
  zoomable: boolean;
  wheelZoom: "always" | "modifier";
  maxZoom: number;
  animate: boolean;
  labels: MapLabels;
  onRegionClick?: (region: ChoroplethRegionInfo) => void;
}) {
  const geometry = useMapGeometry(map, width, height, { projection });
  const regions = useMemo(
    () =>
      geometry.features.map((feature) => {
        const value = lookup(feature)?.value ?? null;
        const stop = value == null ? null : colorScale.color(value);
        return { name: feature.name, id: feature.id, value, color: stop?.color ?? NO_DATA_FILL };
      }),
    [geometry.features, lookup, colorScale],
  );
  const fills = useMemo(() => regions.map((region) => region.color), [regions]);
  const texts = useMemo(
    () =>
      regionLabels === "none"
        ? undefined
        : regions.map((region) =>
            regionLabels === "name"
              ? region.name
              : region.value == null
                ? null
                : format(region.value),
          ),
    [regions, regionLabels, format],
  );
  const controller = useMapView<SVGSVGElement>({
    width,
    height,
    content: geometry.bounds,
    gestures: zoomable,
    wheelZoom,
    maxZoom,
    animate,
  });
  const nav = useIndexNavigation<HTMLDivElement>(regions.length);
  const active = nav.active;
  const current = active == null ? null : (regions[active] ?? null);
  const valueText = current
    ? `${current.name}: ${current.value == null ? labels.noData : format(current.value)}`
    : title;
  const info = (index: number): ChoroplethRegionInfo | null => {
    const region = regions[index];
    return region ? { index, id: region.id, name: region.name, value: region.value } : null;
  };
  const click = (index: number) => {
    const region = info(index);
    if (region) onRegionClick?.(region);
  };

  return (
    <MapViewport
      width={width}
      height={height}
      title={title}
      geometry={geometry}
      labels={labels}
      fills={fills}
      interactive
      activeRegion={active}
      onRegionHover={nav.hover}
      onLeave={nav.leave}
      onRegionClick={click}
      regionLabels={texts}
      controller={controller}
      zoomable={zoomable}
      containerRef={nav.ref}
      reveal={active != null && !nav.pointer ? (geometry.anchors[active] ?? null) : null}
      keyboard={{
        count: regions.length,
        active,
        valueText,
        onKeyDown: nav.sliderProps.onKeyDown,
        onFocus: nav.sliderProps.onFocus,
        onBlur: nav.sliderProps.onBlur,
        onActivate: () => {
          if (active != null) click(active);
        },
      }}
      floating={({ toScreen }) => {
        if (!tooltip || !current) return null;
        const anchor =
          nav.pointer ?? (active == null ? null : toPoint(toScreen, geometry.anchors[active]));
        if (!anchor) return null;
        return (
          <ChartTooltip
            x={anchor.x}
            y={anchor.y}
            containerWidth={width}
            title={current.name}
            rows={[
              {
                id: "value",
                name: valueName,
                value: current.value == null ? labels.noData : format(current.value),
                color: current.color,
              },
            ]}
          />
        );
      }}
    />
  );
}

function toPoint(
  toScreen: (x: number, y: number) => [number, number],
  anchor: [number, number] | undefined,
): { x: number; y: number } | null {
  if (!anchor) return null;
  const [x, y] = toScreen(anchor[0], anchor[1]);
  return { x, y };
}
