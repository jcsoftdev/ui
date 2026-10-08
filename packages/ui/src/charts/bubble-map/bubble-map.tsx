"use client";

import { useMemo } from "react";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { useSeriesState } from "../core/use-series-state.js";
import { type Cluster, clusterPoints } from "../maps/geo/cluster.js";
import { type MapLabels, resolveMapLabels } from "../maps/geo/map-labels.js";
import { MapViewport, type MapViewportContext } from "../maps/geo/map-viewport.js";
import type { GeoMap, ProjectionKind } from "../maps/geo/types.js";
import { defaultMapHeight, useMapGeometry } from "../maps/geo/use-map-geometry.js";
import { useMapView } from "../maps/geo/use-map-view.js";

export interface MapPoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** Drives the bubble area; omit it for fixed-size markers. */
  value?: number;
  /** Colors the marker and groups it in the legend. */
  category?: string;
}

export interface BubbleMapCategory {
  id: string;
  name: string;
  /** CSS color; the palette slot by order otherwise. */
  color?: string;
}

export interface BubbleMapProps {
  title: string;
  /** Base map under the markers, e.g. `peruMap`. */
  map: GeoMap;
  points: readonly MapPoint[];
  /** Legend entries and colors; derived from the points' `category` by order when omitted. */
  categories?: readonly BubbleMapCategory[];
  valueFormat?: ValueFormat;
  /** Name of the value in the tooltip and the data table, e.g. "Citas". */
  valueName?: string;
  projection?: ProjectionKind;
  /** Area-proportional bubbles between these radii (px). Points without `value` use `minRadius`. */
  minRadius?: number;
  maxRadius?: number;
  /** Merge markers closer than `clusterDistance` px into one bubble (count inside, click to zoom in). */
  cluster?: boolean;
  clusterDistance?: number;
  /** Write the region names on the base map where they fit. */
  regionLabels?: boolean;
  height?: number | "fill";
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  zoomable?: boolean;
  wheelZoom?: "always" | "modifier";
  maxZoom?: number;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<MapLabels>;
  onPointClick?: (point: MapPoint) => void;
  className?: string;
}

interface Item {
  key: string;
  cluster: Cluster;
  points: MapPoint[];
  color: string;
}

/**
 * Markers on a map by longitude and latitude, sized by value (area
 * proportional) and colored by category, with optional clustering. Sizes stay
 * in screen pixels while you zoom. Hover or arrow keys select a marker (keyboard
 * order follows the visible bubbles), click or Enter calls `onPointClick`
 * (a cluster zooms in instead), `+` / `-` zoom, `0` fits.
 */
export function BubbleMap({
  title,
  map,
  points,
  categories,
  valueFormat,
  valueName,
  projection,
  minRadius = 6,
  maxRadius = 28,
  cluster = false,
  clusterDistance = 36,
  regionLabels = false,
  height,
  aspectRatio,
  legend = true,
  tooltip = true,
  zoomable = true,
  wheelZoom = "always",
  maxZoom = 16,
  animate = true,
  loading,
  labels: labelsProp,
  onPointClick,
  className,
}: BubbleMapProps) {
  const labels = resolveMapLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const legendState = useSeriesState();
  const categoryList = useMemo<BubbleMapCategory[]>(() => {
    if (categories) return [...categories];
    const seen: BubbleMapCategory[] = [];
    for (const point of points) {
      const id = point.category ?? "";
      if (!seen.some((category) => category.id === id)) seen.push({ id, name: id });
    }
    return seen;
  }, [categories, points]);
  const colorOf = useMemo(() => {
    const colors = new Map(
      categoryList.map((category, index) => [category.id, seriesColor(index, category.color)]),
    );
    return (point: MapPoint) => colors.get(point.category ?? "") ?? seriesColor(0);
  }, [categoryList]);
  const visible = useMemo(
    () => points.filter((point) => !legendState.hidden.has(point.category ?? "")),
    [points, legendState.hidden],
  );
  const showLegend = legend && categoryList.length > 1 && categoryList.every((c) => c.name !== "");
  const legendItems: LegendItem[] = categoryList.map((category) => ({
    id: category.id,
    name: category.name,
    color: seriesColor(categoryList.indexOf(category), category.color),
    shape: "dot",
    hidden: legendState.hidden.has(category.id),
  }));
  const name = valueName ?? labels.value;

  return (
    <ChartFrame
      height={height ?? ((width) => defaultMapHeight(map, width, projection))}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={points.length === 0}
      skeleton="bars"
      className={className}
      legend={
        showLegend ? (
          <ChartLegend
            items={legendItems}
            onToggle={legendState.toggle}
            onHighlight={legendState.setHighlighted}
          />
        ) : null
      }
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.region}
          categories={points.map((point) => point.name)}
          columns={[
            {
              id: "value",
              name,
              values: points.map((point) => (point.value == null ? "" : format(point.value))),
            },
            {
              id: "category",
              name: labels.category,
              values: points.map(
                (point) => categoryList.find((c) => c.id === (point.category ?? ""))?.name ?? "",
              ),
            },
            { id: "lon", name: labels.longitude, values: points.map((p) => p.lon.toFixed(4)) },
            { id: "lat", name: labels.latitude, values: points.map((p) => p.lat.toFixed(4)) },
          ]}
        />
      }
    >
      {(width, drawingHeight) => (
        <BubblePlot
          width={width}
          height={drawingHeight}
          title={title}
          map={map}
          points={visible}
          colorOf={colorOf}
          highlight={legendState.highlighted}
          format={format}
          valueName={name}
          projection={projection}
          minRadius={minRadius}
          maxRadius={maxRadius}
          cluster={cluster}
          clusterDistance={clusterDistance}
          regionLabels={regionLabels}
          tooltip={tooltip}
          zoomable={zoomable}
          wheelZoom={wheelZoom}
          maxZoom={maxZoom}
          animate={animate}
          labels={labels}
          categoryName={(point) =>
            categoryList.find((c) => c.id === (point.category ?? ""))?.name ?? ""
          }
          onPointClick={onPointClick}
        />
      )}
    </ChartFrame>
  );
}

function BubblePlot({
  width,
  height,
  title,
  map,
  points,
  colorOf,
  highlight,
  format,
  valueName,
  projection,
  minRadius,
  maxRadius,
  cluster,
  clusterDistance,
  regionLabels,
  tooltip,
  zoomable,
  wheelZoom,
  maxZoom,
  animate,
  labels,
  categoryName,
  onPointClick,
}: {
  width: number;
  height: number;
  title: string;
  map: GeoMap;
  points: readonly MapPoint[];
  colorOf: (point: MapPoint) => string;
  highlight: string | null;
  format: (value: number) => string;
  valueName: string;
  projection?: ProjectionKind;
  minRadius: number;
  maxRadius: number;
  cluster: boolean;
  clusterDistance: number;
  regionLabels: boolean;
  tooltip: boolean;
  zoomable: boolean;
  wheelZoom: "always" | "modifier";
  maxZoom: number;
  animate: boolean;
  labels: MapLabels;
  categoryName: (point: MapPoint) => string;
  onPointClick?: (point: MapPoint) => void;
}) {
  const geometry = useMapGeometry(map, width, height, { projection });
  const controller = useMapView<SVGSVGElement>({
    width,
    height,
    content: geometry.bounds,
    gestures: zoomable,
    wheelZoom,
    maxZoom,
    animate,
  });
  const base = useMemo(
    () =>
      points.map((point) => {
        const [x, y] = geometry.projection.project(point.lon, point.lat);
        return { x, y, value: point.value ?? 0 };
      }),
    [points, geometry.projection],
  );
  const zoom = controller.view.k;
  const fills = useMemo(() => geometry.features.map(() => "var(--surface-2)"), [geometry.features]);
  const texts = useMemo(
    () => (regionLabels ? geometry.features.map((feature) => feature.name) : undefined),
    [regionLabels, geometry.features],
  );

  // Clustering depends on the zoom only: distances scale uniformly, panning does not change them.
  const items = useMemo<Item[]>(() => {
    const clusters: Cluster[] = cluster
      ? clusterPoints(base, clusterDistance / zoom)
      : base.map((point, index) => ({ ...point, members: [index] }));
    return clusters.map((entry) => {
      const members = entry.members.map((index) => points[index] as MapPoint);
      const dominant = new Map<string, number>();
      for (const member of members) {
        const color = colorOf(member);
        dominant.set(color, (dominant.get(color) ?? 0) + (member.value ?? 1));
      }
      const color =
        [...dominant.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        colorOf(members[0] as MapPoint);
      return {
        key: members.map((member) => member.id).join("+"),
        cluster: entry,
        points: members,
        color,
      };
    });
  }, [base, points, cluster, clusterDistance, zoom, colorOf]);

  const radius = useMemo(() => {
    const top = Math.max(0, ...items.map((item) => item.cluster.value));
    return (item: Item) =>
      top > 0 && item.cluster.value > 0
        ? Math.max(minRadius, maxRadius * Math.sqrt(item.cluster.value / top))
        : minRadius;
  }, [items, minRadius, maxRadius]);

  const nav = useIndexNavigation<HTMLDivElement>(items.length);
  const active = nav.active;
  const current = active == null ? null : (items[active] ?? null);
  const describe = (item: Item) =>
    item.points.length > 1 ? labels.cluster(item.points.length) : (item.points[0]?.name ?? "");
  const valueLabel = (item: Item) =>
    item.points.some((point) => point.value != null) ? format(item.cluster.value) : "";
  const valueText = current
    ? [describe(current), valueLabel(current) && `${valueName}: ${valueLabel(current)}`]
        .filter(Boolean)
        .join(", ")
    : title;

  const activate = (index: number, context?: MapViewportContext) => {
    const item = items[index];
    if (!item) return;
    if (item.points.length === 1) {
      onPointClick?.(item.points[0] as MapPoint);
      return;
    }
    const xs = item.cluster.members.map((member) => (base[member] as { x: number }).x);
    const ys = item.cluster.members.map((member) => (base[member] as { y: number }).y);
    const pad = 14;
    const box = [
      Math.min(...xs) - pad,
      Math.min(...ys) - pad,
      Math.max(...xs) + pad,
      Math.max(...ys) + pad,
    ] as const;
    (context?.focusBox ?? controller.focusBox)(box);
  };

  return (
    <MapViewport
      width={width}
      height={height}
      title={title}
      geometry={geometry}
      labels={labels}
      fills={fills}
      interactive={false}
      regionLabels={texts}
      controller={controller}
      zoomable={zoomable}
      containerRef={nav.ref}
      reveal={current && !nav.pointer ? ([current.cluster.x, current.cluster.y] as const) : null}
      keyboard={{
        count: items.length,
        active,
        valueText,
        onKeyDown: nav.sliderProps.onKeyDown,
        onFocus: nav.sliderProps.onFocus,
        onBlur: nav.sliderProps.onBlur,
        onActivate: () => {
          if (active != null) activate(active);
        },
      }}
      overlay={(context) => (
        <g>
          {items
            .map((item, index) => ({ item, index, r: radius(item) }))
            .sort((a, b) => b.r - a.r)
            .map(({ item, index, r }) => {
              const [x, y] = context.toScreen(item.cluster.x, item.cluster.y);
              if (x < -r || y < -r || x > width + r || y > height + r) return null;
              const isActive = index === active;
              const dim =
                highlight != null && !item.points.some((p) => (p.category ?? "") === highlight);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only mirror of the keyboard model on the focusable slider.
                <g
                  key={item.key}
                  opacity={dim ? 0.25 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerEnter={(event) => !context.dragging && nav.hover(index, event)}
                  onPointerMove={(event) =>
                    !context.dragging && event.buttons === 0 && nav.hover(index, event)
                  }
                  onClick={() => {
                    if (!context.wasDragged()) activate(index, context);
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    style={{
                      fill: item.color,
                      fillOpacity: 0.78,
                      stroke: isActive ? "var(--ink)" : "var(--surface)",
                      strokeWidth: isActive ? 2.5 : 1.5,
                    }}
                  />
                  {item.points.length > 1 && r >= 8 ? (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      pointerEvents="none"
                      className="font-bold text-[11px]"
                      style={{ fill: "var(--surface)" }}
                    >
                      {item.points.length}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </g>
      )}
      onLeave={nav.leave}
      floating={({ toScreen }) => {
        if (!tooltip || !current) return null;
        const [ax, ay] = toScreen(current.cluster.x, current.cluster.y);
        const anchor = nav.pointer ?? { x: ax, y: ay - radius(current) };
        const first = current.points[0] as MapPoint;
        const total = valueLabel(current);
        const category = categoryName(first);
        return (
          <ChartTooltip
            x={anchor.x}
            y={anchor.y}
            containerWidth={width}
            title={describe(current)}
            rows={[
              ...(total
                ? [{ id: "value", name: valueName, value: total, color: current.color }]
                : []),
              ...(category && current.points.length === 1
                ? [{ id: "category", name: category, value: "", color: current.color }]
                : []),
            ]}
          />
        );
      }}
    />
  );
}
