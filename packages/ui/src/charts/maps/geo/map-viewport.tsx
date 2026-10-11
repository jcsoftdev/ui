"use client";

import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
} from "react";
import { cn } from "../../../utils/cn.js";
import { estimateTextWidth } from "../../core/axes.js";
import type { MapLabels } from "./map-labels.js";
import type { MapGeometry } from "./use-map-geometry.js";
import type { MapViewController } from "./use-map-view.js";
import { type MapView, revealPoint, toScreen } from "./view.js";

export interface MapViewportContext {
  view: MapView;
  /** Screen position of a point given in zoom 1 pixels (`geometry.projection.project`). */
  toScreen: (x: number, y: number) => [number, number];
  /** Zooms to a pixel box (zoom 1 coordinates). */
  focusBox: (box: readonly [number, number, number, number]) => void;
  /** True right after a drag: ignore the click that follows. */
  wasDragged: () => boolean;
  /** A pan is in progress: ignore hover. */
  dragging: boolean;
}

export interface MapViewportProps {
  width: number;
  height: number;
  /** Accessible name of the drawing. */
  title: string;
  geometry: MapGeometry;
  labels: MapLabels;
  /** CSS fill of each region. */
  fills: readonly string[];
  /** Regions react to hover, focus and click. Off for a plain base map. */
  interactive: boolean;
  /** Region under the pointer or the keyboard, or null. */
  activeRegion?: number | null;
  onRegionHover?: (index: number, event: { clientX: number; clientY: number }) => void;
  onLeave?: () => void;
  onRegionClick?: (index: number) => void;
  /** Text drawn on each region where it fits (null leaves it out). */
  regionLabels?: ReadonlyArray<string | null>;
  /** Zoom and pan state, from `useMapView`; the parent owns it so markers can depend on the zoom. */
  controller: MapViewController;
  /** Shows the zoom buttons and enables the zoom keys (gestures are configured in `useMapView`). */
  zoomable: boolean;
  /** Ref of the positioned container, for pointer-relative tooltips. */
  containerRef?: RefObject<HTMLDivElement | null>;
  /** Keyboard model, usually from `useIndexNavigation(...).sliderProps`. */
  keyboard?: {
    count: number;
    active: number | null;
    valueText: string;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    /** Enter or Space on the active item. */
    onActivate?: () => void;
  };
  /** Zoom 1 pixel position to keep in view while the keyboard moves (null: no panning). */
  reveal?: readonly [number, number] | null;
  /** SVG drawn in screen space over the regions (markers, bubbles). */
  overlay?: (context: MapViewportContext) => ReactNode;
  /** HTML positioned over the map (tooltips). */
  floating?: (context: MapViewportContext) => ReactNode;
  className?: string;
}

interface RegionsProps {
  paths: readonly string[];
  fills: readonly string[];
  interactive: boolean;
  active: number | null;
  onHover: (index: number, event: PointerEvent<SVGPathElement>) => void;
  onClick: (index: number) => void;
}

const Regions = memo(function Regions({
  paths,
  fills,
  interactive,
  active,
  onHover,
  onClick,
}: RegionsProps) {
  return (
    <g>
      {paths.map((d, index) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only mirror of the keyboard model on the focusable slider.
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: regions follow the topology order.
          key={index}
          d={d}
          fillRule="evenodd"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          className="motion-safe:transition-[fill] motion-safe:duration-150"
          style={{
            fill: fills[index],
            stroke: "var(--surface)",
            strokeWidth: 1,
            cursor: interactive ? "pointer" : undefined,
          }}
          onPointerEnter={interactive ? (event) => onHover(index, event) : undefined}
          onPointerMove={interactive ? (event) => onHover(index, event) : undefined}
          onClick={interactive ? () => onClick(index) : undefined}
        />
      ))}
      {interactive && active != null && paths[active] ? (
        <path
          d={paths[active]}
          fill="none"
          fillRule="evenodd"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          pointerEvents="none"
          style={{ stroke: "var(--ink)", strokeWidth: 2 }}
        />
      ) : null}
    </g>
  );
});

const ZOOM_KEYS: Record<string, "in" | "out" | "fit" | undefined> = {
  "+": "in",
  "=": "in",
  "-": "out",
  _: "out",
  "0": "fit",
};

const LABEL_STYLE = {
  paintOrder: "stroke",
  stroke: "var(--surface)",
  strokeWidth: 3,
  strokeLinejoin: "round",
} as const;

function RegionLabels({
  view,
  geometry,
  texts,
  width,
  height,
}: {
  view: MapView;
  geometry: MapGeometry;
  texts: ReadonlyArray<string | null>;
  width: number;
  height: number;
}) {
  const placed = useMemo(() => {
    const order = geometry.boxes
      .map((box, index) => ({ index, area: (box[2] - box[0]) * (box[3] - box[1]) }))
      .sort((a, b) => b.area - a.area);
    const taken: Array<[number, number, number, number]> = [];
    const out: Array<{ index: number; x: number; y: number; text: string }> = [];
    for (const { index } of order) {
      const text = texts[index];
      const box = geometry.boxes[index];
      const anchor = geometry.anchors[index];
      if (!text || !box || !anchor) continue;
      const boxWidth = (box[2] - box[0]) * view.k;
      const boxHeight = (box[3] - box[1]) * view.k;
      const textWidth = estimateTextWidth(text, 11) * 1.05;
      if (boxWidth < textWidth + 8 || boxHeight < 16) continue;
      const [x, y] = toScreen(view, anchor[0], anchor[1]);
      if (x < textWidth / 2 || x > width - textWidth / 2 || y < 8 || y > height - 8) continue;
      const rect: [number, number, number, number] = [
        x - textWidth / 2,
        y - 7,
        x + textWidth / 2,
        y + 7,
      ];
      if (taken.some((t) => rect[0] < t[2] && rect[2] > t[0] && rect[1] < t[3] && rect[3] > t[1]))
        continue;
      taken.push(rect);
      out.push({ index, x, y, text });
    }
    return out;
  }, [view, geometry, texts, width, height]);
  return (
    <g pointerEvents="none">
      {placed.map(({ index, x, y, text }) => (
        <text
          key={index}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink font-semibold text-fs-110"
          style={LABEL_STYLE}
        >
          {text}
        </text>
      ))}
    </g>
  );
}

const BUTTON =
  "inline-flex size-8 cursor-pointer items-center justify-center border-0 bg-surface-overlay text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:-outline-offset-2 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-float";

function Glyph({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The shared stage of the maps: draws the regions of a fitted geometry, owns
 * zoom and pan (wheel, drag, pinch, buttons, keys), the region labels, the
 * zoom buttons and the focusable keyboard layer. Charts supply fills,
 * hover/click semantics, an SVG overlay (markers) and HTML (tooltip).
 */
export function MapViewport({
  width,
  height,
  title,
  geometry,
  labels,
  fills,
  interactive,
  activeRegion = null,
  onRegionHover,
  onLeave,
  onRegionClick,
  regionLabels,
  controller: map,
  zoomable,
  containerRef,
  keyboard,
  reveal,
  overlay,
  floating,
  className,
}: MapViewportProps) {
  const { view, wasDragged, zoomBy, fit, panBy, focusBox, animateTo } = map;

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new target pans the view.
  useEffect(() => {
    if (!reveal) return;
    const next = revealPoint(map.view, reveal[0], reveal[1], width, height);
    if (next !== map.view) animateTo(next);
  }, [reveal?.[0], reveal?.[1]]);

  const context: MapViewportContext = {
    view,
    toScreen: (x, y) => toScreen(view, x, y),
    focusBox,
    wasDragged,
    dragging: map.dragging,
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (zoomable) {
      const zoomKey = ZOOM_KEYS[event.key];
      if (zoomKey) {
        event.preventDefault();
        if (zoomKey === "fit") fit();
        else zoomBy(zoomKey === "in" ? 1.6 : 1 / 1.6);
        return;
      }
      if (event.shiftKey && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = 64;
        panBy(
          event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
          event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
        );
        return;
      }
    }
    if ((event.key === "Enter" || event.key === " ") && keyboard?.onActivate) {
      event.preventDefault();
      keyboard.onActivate();
      return;
    }
    keyboard?.onKeyDown?.(event);
  };

  const hover = (index: number, event: PointerEvent<SVGPathElement>) => {
    if (map.dragging || event.buttons !== 0) return;
    onRegionHover?.(index, event);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none overflow-hidden", className)}
      style={{ width, height }}
    >
      <svg
        ref={map.ref}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn(
          "block",
          zoomable && "touch-none",
          zoomable && (map.dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        onPointerLeave={onLeave}
        {...map.pointerProps}
      >
        <g
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: "0 0",
          }}
        >
          <Regions
            paths={geometry.paths}
            fills={fills}
            interactive={interactive}
            active={activeRegion}
            onHover={hover}
            onClick={(index) => {
              if (!wasDragged()) onRegionClick?.(index);
            }}
          />
        </g>
        {regionLabels ? (
          <RegionLabels
            view={view}
            geometry={geometry}
            texts={regionLabels}
            width={width}
            height={height}
          />
        ) : null}
        {overlay?.(context)}
      </svg>
      {zoomable ? (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would add form semantics and default styling to a floating toolbar.
        <div
          role="group"
          aria-label={labels.controls}
          className="absolute top-2 right-2 flex flex-col divide-y divide-line overflow-hidden rounded-event shadow-overlay"
        >
          <button
            type="button"
            className={BUTTON}
            aria-label={labels.zoomIn}
            disabled={!map.canZoomIn}
            onClick={() => zoomBy(1.6)}
          >
            <Glyph d="M8 3v10M3 8h10" />
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={labels.zoomOut}
            disabled={!map.canZoomOut}
            onClick={() => zoomBy(1 / 1.6)}
          >
            <Glyph d="M3 8h10" />
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={labels.fit}
            disabled={view.k <= 1.0001}
            onClick={fit}
          >
            <Glyph d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </button>
        </div>
      ) : null}
      {keyboard ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={labels.explore}
          aria-valuemin={1}
          aria-valuemax={Math.max(1, keyboard.count)}
          aria-valuenow={(keyboard.active ?? 0) + 1}
          aria-valuetext={keyboard.valueText}
          onKeyDown={onKeyDown}
          onFocus={keyboard.onFocus}
          onBlur={keyboard.onBlur}
          className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:-outline-offset-2"
        />
      ) : null}
      {floating?.(context)}
    </div>
  );
}
