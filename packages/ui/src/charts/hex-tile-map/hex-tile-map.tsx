"use client";

import { useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import type { ChoroplethDatum, ChoroplethRegionInfo } from "../choropleth-map/choropleth-map.js";
import { DECORATIVE } from "../core/a11y.js";
import { ChartFrame } from "../core/chart-frame.js";
import { type ColorRange, inkOn, type ScaleColors } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { heatmapScale } from "../heatmap-chart/heatmap-scale.js";
import { type MapLabels, resolveMapLabels } from "../maps/geo/map-labels.js";
import { MapLegend } from "../maps/geo/map-legend.js";
import { createRegionIndex } from "../maps/geo/match.js";
import { type HexTile, hexPoints, layoutHexGrid, PERU_HEX_TILES } from "./hex-layout.js";

export interface HexTileMapProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** One value per tile, matched by `id` (or the tile name; accents and case are ignored). */
  data: readonly ChoroplethDatum[];
  /** The tiles and their grid cells; Peru's 25 regions by default. */
  tiles?: readonly HexTile[];
  scale?: "sequential" | "diverging";
  domain?: readonly [number, number];
  center?: number;
  colors?: ScaleColors;
  /** Stepped (threshold) coloring; replaces the continuous scale. */
  ranges?: readonly ColorRange[];
  valueFormat?: ValueFormat;
  /** Name of the value in the tooltip and the data table, e.g. "Clientes". */
  valueName?: string;
  /** What is written on a tile where it fits: the code, the value, both or nothing. */
  tileLabels?: "code" | "value" | "both" | "none";
  /** Height in px, "fill" or a default that follows the grid's proportions. */
  height?: number | "fill";
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<MapLabels>;
  onTileClick?: (tile: ChoroplethRegionInfo) => void;
  className?: string;
}

const NO_DATA_FILL = "var(--surface-2)";

function defaultHeight(tiles: readonly HexTile[], width: number): number {
  const grid = layoutHexGrid(tiles, 1000, 1000);
  const ratio = grid.width > 0 ? grid.height / grid.width : 1;
  return Math.round(Math.min(640, Math.max(220, width * ratio)));
}

/**
 * Tile map: every region is one hexagon of the same size, so small regions (Callao, Tumbes)
 * weigh as much as large ones and nothing hides behind Loreto. Colored by value like
 * `ChoroplethMap`, with the same legend, tooltip, keyboard model and data table. The default
 * layout is Peru's 25 regions; pass `tiles` for any other territory.
 */
export function HexTileMap({
  title,
  data,
  tiles = PERU_HEX_TILES,
  scale = "sequential",
  domain,
  center = 0,
  colors,
  ranges,
  valueFormat,
  valueName,
  tileLabels = "both",
  height,
  aspectRatio,
  legend = true,
  tooltip = true,
  animate = true,
  loading,
  labels: labelsProp,
  onTileClick,
  className,
}: HexTileMapProps) {
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
  const cells = useMemo(
    () =>
      tiles.map((tile) => {
        const value = lookup(tile)?.value ?? null;
        const stop = value == null ? null : colorScale.color(value);
        return {
          tile,
          value,
          color: stop?.color ?? NO_DATA_FILL,
          ink: stop ? inkOn(stop.strength) : "var(--ink-2)",
        };
      }),
    [tiles, lookup, colorScale],
  );

  return (
    <ChartFrame
      height={height ?? ((width) => defaultHeight(tiles, width))}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={finite.length === 0}
      skeleton="bars"
      className={className}
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
        <ChartDataTable
          caption={title}
          categoryHeader={labels.region}
          categories={cells.map((cell) => cell.tile.name)}
          columns={[
            {
              id: "value",
              name,
              values: cells.map((cell) =>
                cell.value == null ? labels.noData : format(cell.value),
              ),
            },
          ]}
        />
      }
    >
      {(width, drawingHeight) => (
        <HexPlot
          width={width}
          height={drawingHeight}
          title={title}
          cells={cells}
          format={format}
          valueName={name}
          tileLabels={tileLabels}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          onTileClick={onTileClick}
        />
      )}
    </ChartFrame>
  );
}

interface Cell {
  tile: HexTile;
  value: number | null;
  color: string;
  ink: string;
}

function HexPlot({
  width,
  height,
  title,
  cells,
  format,
  valueName,
  tileLabels,
  tooltip,
  animate,
  labels,
  onTileClick,
}: {
  width: number;
  height: number;
  title: string;
  cells: readonly Cell[];
  format: (value: number) => string;
  valueName: string;
  tileLabels: "code" | "value" | "both" | "none";
  tooltip: boolean;
  animate: boolean;
  labels: MapLabels;
  onTileClick?: (tile: ChoroplethRegionInfo) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const grid = useMemo(
    () =>
      layoutHexGrid(
        cells.map((cell) => cell.tile),
        width,
        height,
      ),
    [cells, width, height],
  );
  const nav = useIndexNavigation<HTMLDivElement>(cells.length);
  const active = nav.active;
  const current = active == null ? null : (cells[active] ?? null);
  const valueText = current
    ? `${current.tile.name}: ${current.value == null ? labels.noData : format(current.value)}`
    : title;
  const gap = Math.max(1.5, grid.size * 0.08);
  const codeSize = Math.max(8, Math.min(13, grid.size * 0.46));
  const valueSize = Math.max(8, Math.min(11, grid.size * 0.36));
  const showCode = tileLabels !== "none" && tileLabels !== "value" && grid.size >= 15;
  const showValue = (tileLabels === "value" || tileLabels === "both") && grid.size >= 24;

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-tile]").forEach((node, i) => {
        node.animate(
          [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 380, delay: i * 14, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate },
  );

  const click = (index: number) => {
    const cell = cells[index];
    if (cell) {
      onTileClick?.({ index, id: cell.tile.id, name: cell.tile.name, value: cell.value });
    }
  };
  const anchor = current && active != null ? (grid.centers[active] ?? null) : null;

  return (
    <div
      ref={nav.ref}
      className="relative"
      style={{ width, height }}
      onPointerLeave={nav.pointerLeave}
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        {cells.map((cell, index) => {
          const [cx, cy] = grid.centers[index] as [number, number];
          const isActive = index === active;
          const text = [
            showCode ? cell.tile.code : null,
            showValue && cell.value != null ? format(cell.value) : null,
          ].filter(Boolean);
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: pointer mirror of the keyboard model on the slider below.
            <g
              key={cell.tile.id}
              data-tile=""
              style={{
                cursor: onTileClick ? "pointer" : "default",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
              onPointerEnter={(event) => nav.hover(index, event)}
              onPointerMove={(event) => nav.hover(index, event)}
              onClick={() => click(index)}
            >
              <polygon
                points={hexPoints(cx, cy, grid.size, gap / 2)}
                strokeLinejoin="round"
                className="motion-safe:transition-[fill] motion-safe:duration-150"
                style={{
                  fill: cell.color,
                  stroke: isActive ? "var(--ink)" : "var(--surface)",
                  strokeWidth: isActive ? 2.5 : 1,
                }}
              />
              {text.length > 0 ? (
                <text
                  {...DECORATIVE}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  className="pointer-events-none font-bold tabular-nums"
                  style={{ fill: cell.ink }}
                >
                  <tspan
                    x={cx}
                    dy={text.length > 1 ? "-0.15em" : "0.35em"}
                    fontSize={showCode ? codeSize : valueSize}
                  >
                    {text[0]}
                  </tspan>
                  {text.length > 1 ? (
                    <tspan x={cx} dy="1.2em" fontSize={valueSize} className="font-semibold">
                      {text[1]}
                    </tspan>
                  ) : null}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, cells.length)}
        aria-valuenow={(active ?? 0) + 1}
        aria-valuetext={valueText}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && active != null) {
            event.preventDefault();
            click(active);
            return;
          }
          nav.sliderProps.onKeyDown(event);
        }}
        onFocus={nav.sliderProps.onFocus}
        onBlur={nav.sliderProps.onBlur}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xs outline-none",
          "focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
        )}
      />
      {tooltip && current ? (
        <ChartTooltip
          x={nav.pointer?.x ?? anchor?.[0] ?? 0}
          y={nav.pointer?.y ?? anchor?.[1] ?? 0}
          containerWidth={width}
          title={current.tile.name}
          rows={[
            {
              id: "value",
              name: valueName,
              value: current.value == null ? labels.noData : format(current.value),
              color: current.color,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
