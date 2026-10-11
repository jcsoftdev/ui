"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { type MapPoint, type MapRoute, resolveRoutes } from "../bubble-map/bubble-map.js";
import type { ChoroplethDatum } from "../choropleth-map/choropleth-map.js";
import { ChartFrame } from "../core/chart-frame.js";
import type { ColorRange, ScaleColors } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { useReducedMotion } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { heatmapScale } from "../heatmap-chart/heatmap-scale.js";
import {
  dragRotation,
  type GlobeDisc,
  type GlobeRotation,
  globeArc,
  globeLinePieces,
  globeRingsPath,
  graticuleLines,
  keyRotation,
  normalizeRotation,
  projectOrthographic,
  spinRotation,
  toVec,
  type Vec3,
} from "../maps/geo/globe.js";
import { type MapLabels, resolveMapLabels } from "../maps/geo/map-labels.js";
import { MapLegend } from "../maps/geo/map-legend.js";
import { createRegionIndex } from "../maps/geo/match.js";
import { routePolylinePath } from "../maps/geo/routes.js";
import { geometryRings } from "../maps/geo/topojson.js";
import type { GeoMap } from "../maps/geo/types.js";
import { mapFeatures } from "../maps/geo/use-map-geometry.js";

/** Visible strings of the globe, on top of the shared map strings. */
export interface GlobeLabels extends MapLabels {
  /** Button that returns to the initial view. */
  resetView: string;
  /** Buttons that stop and start the idle spin. */
  pauseSpin: string;
  playSpin: string;
  /** Spoken position of the view center. */
  centerAt: (lon: number, lat: number) => string;
}

const fmtDegrees = (value: number, positive: string, negative: string) =>
  `${Math.abs(Math.round(value))}° ${value >= 0 ? positive : negative}`;

export const DEFAULT_GLOBE_LABELS: GlobeLabels = {
  ...resolveMapLabels({
    explore:
      "Globe. Drag or use the arrow keys to rotate it, zero to return to the first view, space to pause the spin.",
    empty: "No globe data to show",
    loading: "Loading globe",
  }),
  resetView: "Reset view",
  pauseSpin: "Pause rotation",
  playSpin: "Start rotation",
  centerAt: (lon, lat) => `Centered on ${fmtDegrees(lat, "N", "S")}, ${fmtDegrees(lon, "E", "W")}`,
};

export interface GlobeChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Land to draw, e.g. `worldMap` from `@jcsoftdev/ui/charts/maps/data/world`. */
  map: GeoMap;
  /** Value per region (id or name); fills the land with a color scale. */
  data?: readonly ChoroplethDatum[];
  scale?: "sequential" | "diverging";
  domain?: readonly [number, number];
  center?: number;
  colors?: ScaleColors;
  ranges?: readonly ColorRange[];
  valueFormat?: ValueFormat;
  /** Name of the value in the tooltip and the data table. */
  valueName?: string;
  /** Markers on the surface, area-proportional when they carry a `value`. */
  points?: readonly MapPoint[];
  /** Great-circle arcs between places, lifted a little over the surface. */
  routes?: readonly MapRoute[];
  minRadius?: number;
  maxRadius?: number;
  /** Meridians and parallels. */
  graticule?: boolean;
  /** Degrees between graticule lines (30 by default). */
  graticuleStep?: number;
  /** View center when the user has not turned the globe yet. Lima by default. */
  initialRotation?: GlobeRotation;
  /** Controlled view center; combine with `onRotationChange`. */
  rotation?: GlobeRotation;
  onRotationChange?: (rotation: GlobeRotation) => void;
  /** Slow idle spin that pauses while the pointer or focus is on the globe. Off under reduced motion. */
  autoRotate?: boolean;
  /** Degrees per second of the idle spin. */
  autoRotateSpeed?: number;
  height?: number | "fill";
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  /** The numbers as a screen-reader table (always hidden visually). */
  dataTable?: "hidden";
  loading?: boolean;
  labels?: Partial<GlobeLabels>;
  onRegionClick?: (region: { id: string; name: string; value: number | null }) => void;
  onPointClick?: (point: MapPoint) => void;
  className?: string;
}

const NO_DATA_FILL = "var(--surface-2)";
const ROTATION_DEFAULT: GlobeRotation = { lon: -75, lat: -10 };
const ringCache = new WeakMap<GeoMap, Vec3[][][]>();

/** World vectors of every ring of every region (once per map). */
function featureRings(map: GeoMap): Vec3[][][] {
  let cached = ringCache.get(map);
  if (!cached) {
    cached = mapFeatures(map).map((feature) =>
      geometryRings(feature.geometry).map((ring) => ring.map((position) => toVec(position))),
    );
    ringCache.set(map, cached);
  }
  return cached;
}

/**
 * The world as a globe (orthographic projection) you turn with the pointer or the arrow keys.
 * Regions can be colored by value, markers sized by value and great-circle routes drawn over the
 * surface. It fills its container as a disc, adapts to any width and keeps every interaction
 * available without a pointer.
 */
export function GlobeChart({
  title,
  map,
  data = [],
  scale = "sequential",
  domain,
  center = 0,
  colors,
  ranges,
  valueFormat,
  valueName,
  points = [],
  routes = [],
  minRadius = 4,
  maxRadius = 16,
  graticule = true,
  graticuleStep = 30,
  initialRotation = ROTATION_DEFAULT,
  rotation: controlled,
  onRotationChange,
  autoRotate = false,
  autoRotateSpeed = 8,
  height,
  aspectRatio,
  legend = true,
  tooltip = true,
  loading,
  labels: labelsProp,
  onRegionClick,
  onPointClick,
  className,
}: GlobeChartProps) {
  const labels = useMemo<GlobeLabels>(
    () => ({ ...DEFAULT_GLOBE_LABELS, ...labelsProp }),
    [labelsProp],
  );
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const lookup = useMemo(() => createRegionIndex(data), [data]);
  const features = useMemo(() => mapFeatures(map), [map]);
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
  const categories = useMemo(() => {
    const ids: string[] = [];
    for (const point of points) {
      if (point.category && !ids.includes(point.category)) ids.push(point.category);
    }
    return ids;
  }, [points]);
  const legendItems = useMemo<LegendItem[]>(
    () =>
      categories.map((id, index) => ({
        id,
        name: id,
        color: seriesColor(index),
        shape: "dot",
      })),
    [categories],
  );
  const name = valueName ?? labels.value;

  return (
    <ChartFrame
      height={height ?? ((width) => Math.round(Math.min(640, Math.max(220, width))))}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={features.length === 0}
      skeleton="ring"
      className={className}
      legend={legendItems.length > 1 ? <ChartLegend items={legendItems} align="center" /> : null}
      footer={
        legend && finite.length > 0 ? (
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
        <>
          {data.length > 0 ? (
            <ChartDataTable
              caption={title}
              categoryHeader={labels.region}
              categories={features.map((feature) => feature.name)}
              columns={[
                {
                  id: "value",
                  name,
                  values: features.map((feature) => {
                    const value = lookup(feature)?.value;
                    return value == null ? labels.noData : format(value);
                  }),
                },
              ]}
            />
          ) : null}
          {points.length > 0 ? (
            <ChartDataTable
              caption={`${title}: ${labels.longitude} / ${labels.latitude}`}
              categoryHeader={labels.region}
              categories={points.map((point) => point.name)}
              columns={[
                {
                  id: "lon",
                  name: labels.longitude,
                  values: points.map((point) => point.lon.toFixed(2)),
                },
                {
                  id: "lat",
                  name: labels.latitude,
                  values: points.map((point) => point.lat.toFixed(2)),
                },
                ...(points.some((point) => point.value != null)
                  ? [
                      {
                        id: "value",
                        name,
                        values: points.map((point) =>
                          point.value == null ? "" : format(point.value),
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
        </>
      }
    >
      {(width, drawingHeight) => (
        <GlobePlot
          width={width}
          height={drawingHeight}
          title={title}
          map={map}
          lookup={lookup}
          colorScale={colorScale}
          format={format}
          valueName={name}
          points={points}
          categories={categories}
          routes={routes}
          minRadius={minRadius}
          maxRadius={maxRadius}
          graticule={graticule}
          graticuleStep={graticuleStep}
          initialRotation={initialRotation}
          controlled={controlled}
          onRotationChange={onRotationChange}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          tooltip={tooltip}
          labels={labels}
          onRegionClick={onRegionClick}
          onPointClick={onPointClick}
        />
      )}
    </ChartFrame>
  );
}

type Hover = { kind: "region"; index: number } | { kind: "point"; index: number } | null;

interface GlobePlotProps {
  width: number;
  height: number;
  title: string;
  map: GeoMap;
  lookup: (feature: { id: string; name: string }) => ChoroplethDatum | undefined;
  colorScale: ReturnType<typeof heatmapScale>;
  format: (value: number) => string;
  valueName: string;
  points: readonly MapPoint[];
  categories: readonly string[];
  routes: readonly MapRoute[];
  minRadius: number;
  maxRadius: number;
  graticule: boolean;
  graticuleStep: number;
  initialRotation: GlobeRotation;
  controlled?: GlobeRotation;
  onRotationChange?: (rotation: GlobeRotation) => void;
  autoRotate: boolean;
  autoRotateSpeed: number;
  tooltip: boolean;
  labels: GlobeLabels;
  onRegionClick?: GlobeChartProps["onRegionClick"];
  onPointClick?: GlobeChartProps["onPointClick"];
}

function GlobePlot({
  width,
  height,
  title,
  map,
  lookup,
  colorScale,
  format,
  valueName,
  points,
  categories,
  routes,
  minRadius,
  maxRadius,
  graticule,
  graticuleStep,
  initialRotation,
  controlled,
  onRotationChange,
  autoRotate,
  autoRotateSpeed,
  tooltip,
  labels,
  onRegionClick,
  onPointClick,
}: GlobePlotProps) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const [inner, setInner] = useState<GlobeRotation>(() => normalizeRotation(initialRotation));
  const rotation = controlled ? normalizeRotation(controlled) : inner;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  const setRotation = useCallback(
    (next: GlobeRotation) => {
      setInner(next);
      onRotationChange?.(next);
    },
    [onRotationChange],
  );

  const [hover, setHover] = useState<Hover>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [paused, setPaused] = useState(false);
  const press = useRef<{ x: number; y: number; moved: number } | null>(null);
  const dragged = useRef(false);

  const disc = useMemo<GlobeDisc>(
    () => ({
      cx: width / 2,
      cy: height / 2,
      radius: Math.max(24, Math.min(width, height) / 2 - 6),
    }),
    [width, height],
  );
  const spinning = autoRotate && !reduced && !paused && !engaged;
  useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      setRotation(spinRotation(rotationRef.current, seconds, autoRotateSpeed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning, autoRotateSpeed, setRotation]);

  const rings = useMemo(() => featureRings(map), [map]);
  const features = useMemo(() => mapFeatures(map), [map]);
  const regions = useMemo(
    () =>
      features.map((feature) => {
        const value = lookup(feature)?.value ?? null;
        const stop = value == null ? null : colorScale.color(value);
        return { id: feature.id, name: feature.name, value, color: stop?.color ?? NO_DATA_FILL };
      }),
    [features, lookup, colorScale],
  );
  const paths = useMemo(
    () => rings.map((featureRingSet) => globeRingsPath(featureRingSet, rotation, disc)),
    [rings, rotation, disc],
  );
  const graticuleVectors = useMemo(
    () => graticuleLines(graticuleStep).map((line) => line.map((position) => toVec(position))),
    [graticuleStep],
  );
  const graticulePath = useMemo(
    () =>
      graticule
        ? routePolylinePath(
            graticuleVectors.flatMap((line) => globeLinePieces(line, rotation, disc)),
          )
        : "",
    [graticule, graticuleVectors, rotation, disc],
  );
  const arcs = useMemo(
    () =>
      resolveRoutes(routes, points).map((resolved) => ({
        resolved,
        vectors: globeArc(resolved.from, resolved.to, 56, 0.07),
      })),
    [routes, points],
  );
  const arcPaths = useMemo(
    () => arcs.map(({ vectors }) => routePolylinePath(globeLinePieces(vectors, rotation, disc))),
    [arcs, rotation, disc],
  );
  const extent = useMemo(() => {
    const values = points.flatMap((point) => (point.value == null ? [] : [point.value]));
    return [Math.min(0, ...values), Math.max(1, ...values)] as const;
  }, [points]);
  const markers = useMemo(
    () =>
      points.flatMap((point, index) => {
        const at = projectOrthographic([point.lon, point.lat], rotation, disc);
        if (!at) return [];
        const share = point.value == null ? 0 : Math.sqrt(point.value / extent[1]);
        const radius =
          point.value == null ? minRadius : minRadius + (maxRadius - minRadius) * share;
        const category = point.category ? categories.indexOf(point.category) : -1;
        return [
          {
            point,
            index,
            x: at[0],
            y: at[1],
            radius,
            color: category >= 0 ? seriesColor(category) : "var(--accent)",
          },
        ];
      }),
    [points, rotation, disc, extent, minRadius, maxRadius, categories],
  );

  const local = (event: PointerEvent<Element>) => {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    press.current = { x: event.clientX, y: event.clientY, moved: 0 };
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setEngaged(true);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = press.current;
    if (start) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start.x = event.clientX;
      start.y = event.clientY;
      start.moved += Math.abs(dx) + Math.abs(dy);
      if (start.moved > 4) {
        dragged.current = true;
        setHover(null);
        setRotation(dragRotation(rotationRef.current, dx, dy, disc.radius));
      }
      return;
    }
    setPointer(local(event));
    const target = (event.target as Element).closest("[data-region],[data-point]");
    if (!target) return setHover(null);
    const point = target.getAttribute("data-point");
    if (point != null) return setHover({ kind: "point", index: Number(point) });
    setHover({ kind: "region", index: Number(target.getAttribute("data-region")) });
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    press.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setEngaged(false);
  };
  const onClick = () => {
    if (dragged.current || !hover) return;
    if (hover.kind === "point") {
      const point = points[hover.index];
      if (point) onPointClick?.(point);
    } else {
      const region = regions[hover.index];
      if (region) onRegionClick?.({ id: region.id, name: region.name, value: region.value });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyRotation(rotationRef.current, event.key, event.shiftKey ? 30 : 10);
    if (next) setRotation(next);
    else if (event.key === "0" || event.key === "Home")
      setRotation(normalizeRotation(initialRotation));
    else if (event.key === " " && autoRotate) setPaused((value) => !value);
    else if (event.key === "Escape") setHover(null);
    else return;
    event.preventDefault();
  };

  const activeRegion = hover?.kind === "region" ? regions[hover.index] : undefined;
  const activePoint = hover?.kind === "point" ? points[hover.index] : undefined;
  const buttonClass =
    "inline-flex h-7 cursor-pointer items-center rounded-button border-0 bg-surface-2 px-3 font-semibold text-fs-120 text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink";

  return (
    <div className="relative" style={{ width, height }}>
      <div
        role="slider"
        tabIndex={0}
        aria-roledescription="globe"
        aria-label={`${title}. ${labels.explore}`}
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={Math.round(rotation.lon)}
        aria-valuetext={labels.centerAt(rotation.lon, rotation.lat)}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => {
          if (!press.current) {
            setEngaged(false);
            setHover(null);
            setPointer(null);
          }
        }}
        className="relative rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
        style={{ width, height }}
      >
        <svg
          role="img"
          aria-label={title}
          width={width}
          height={height}
          className={cn(
            "block touch-none select-none overflow-visible",
            press.current ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <clipPath id={`${uid}-disc`}>
              <circle cx={disc.cx} cy={disc.cy} r={disc.radius} />
            </clipPath>
            <radialGradient id={`${uid}-shade`} cx="38%" cy="34%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.14" />
            </radialGradient>
          </defs>
          <circle cx={disc.cx} cy={disc.cy} r={disc.radius} style={{ fill: "var(--sunken)" }} />
          <g clipPath={`url(#${uid}-disc)`}>
            {graticulePath ? (
              <path
                d={graticulePath}
                fill="none"
                strokeWidth={0.75}
                style={{ stroke: "var(--line)" }}
              />
            ) : null}
            <g fillRule="evenodd" strokeLinejoin="round">
              {regions.map((region, index) => {
                const d = paths[index];
                if (!d) return null;
                const active = hover?.kind === "region" && hover.index === index;
                return (
                  <path
                    key={region.id}
                    d={d}
                    data-region={index}
                    strokeWidth={active ? 1.6 : 0.6}
                    style={{
                      fill: region.color,
                      stroke: active ? "var(--accent-word)" : "var(--surface)",
                    }}
                  />
                );
              })}
            </g>
            <circle
              cx={disc.cx}
              cy={disc.cy}
              r={disc.radius}
              fill={`url(#${uid}-shade)`}
              pointerEvents="none"
            />
          </g>
          <circle
            cx={disc.cx}
            cy={disc.cy}
            r={disc.radius}
            fill="none"
            strokeWidth={1.25}
            pointerEvents="none"
            style={{ stroke: "var(--line-strong)" }}
          />
          <g fill="none" strokeLinecap="round" pointerEvents="none" clipPath={`url(#${uid}-disc)`}>
            {arcs.map(({ resolved }, index) => (
              <path
                key={resolved.route.id}
                d={arcPaths[index]}
                strokeWidth={
                  resolved.route.value == null
                    ? 1.6
                    : 1 + Math.min(3, Math.sqrt(resolved.route.value) / 6)
                }
                strokeOpacity={0.85}
                style={{ stroke: resolved.route.color ?? "var(--accent-word)" }}
              />
            ))}
          </g>
          <g>
            {markers.map((marker) => (
              <circle
                key={marker.point.id}
                data-point={marker.index}
                cx={marker.x}
                cy={marker.y}
                r={marker.radius}
                fillOpacity={0.78}
                strokeWidth={hover?.kind === "point" && hover.index === marker.index ? 2.5 : 1.25}
                style={{ fill: marker.color, stroke: "var(--surface)" }}
              />
            ))}
          </g>
        </svg>
        <span className="sr-only" aria-live="polite">
          {labels.centerAt(rotation.lon, rotation.lat)}
        </span>
        {tooltip && pointer && !engagedDrag(press.current) ? (
          activePoint ? (
            <ChartTooltip
              x={pointer.x}
              y={pointer.y}
              containerWidth={width}
              title={activePoint.name}
              rows={
                activePoint.value == null
                  ? []
                  : [
                      {
                        id: "value",
                        name: valueName,
                        value: format(activePoint.value),
                        color: "var(--accent)",
                      },
                    ]
              }
            />
          ) : activeRegion ? (
            <ChartTooltip
              x={pointer.x}
              y={pointer.y}
              containerWidth={width}
              title={activeRegion.name}
              rows={[
                {
                  id: "value",
                  name: valueName,
                  value: activeRegion.value == null ? labels.noData : format(activeRegion.value),
                  color: activeRegion.color,
                },
              ]}
            />
          ) : null
        ) : null}
      </div>
      <div className="absolute top-0 right-0 flex gap-1">
        <button
          type="button"
          className={buttonClass}
          onClick={() => setRotation(normalizeRotation(initialRotation))}
        >
          {labels.resetView}
        </button>
        {autoRotate && !reduced ? (
          <button
            type="button"
            aria-pressed={paused}
            className={buttonClass}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? labels.playSpin : labels.pauseSpin}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function engagedDrag(press: { moved: number } | null): boolean {
  return press != null && press.moved > 4;
}
