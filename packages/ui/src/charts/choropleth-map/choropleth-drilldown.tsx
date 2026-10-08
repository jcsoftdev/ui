"use client";

import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartBreadcrumb } from "../core/breadcrumb.js";
import type { ValueFormat } from "../core/format.js";
import type { GeoMap } from "../maps/geo/types.js";
import {
  type ChoroplethDatum,
  ChoroplethMap,
  type ChoroplethMapProps,
  type ChoroplethRegionInfo,
} from "./choropleth-map.js";

/** One level of a drilldown: a map and the values of its regions. */
export interface DrilldownLevel {
  id: string;
  /** Name in the breadcrumb, e.g. "Mundo" or "Perú". */
  name: string;
  map: GeoMap;
  data: readonly ChoroplethDatum[];
  /** Overrides the value name / format of the map for this level. */
  valueName?: string;
  valueFormat?: ValueFormat;
}

export interface ChoroplethDrilldownProps
  extends Omit<ChoroplethMapProps, "map" | "data" | "onRegionClick" | "title"> {
  /** Accessible name; the current level is appended: "Clientes: Perú". */
  title: string;
  root: DrilldownLevel;
  /**
   * Level to open when a region is clicked, given the path so far (root first), or nothing when
   * that region has no detail (the click goes to `onRegionClick`).
   */
  resolve: (
    region: ChoroplethRegionInfo,
    path: readonly DrilldownLevel[],
  ) => DrilldownLevel | null | undefined;
  /** Accessible name of the breadcrumb navigation. */
  breadcrumbLabel?: string;
  /** Called after every change of level with the new path (root first). */
  onNavigate?: (path: readonly DrilldownLevel[]) => void;
  /** Click on a region without detail. */
  onRegionClick?: (region: ChoroplethRegionInfo, path: readonly DrilldownLevel[]) => void;
}

/**
 * `ChoroplethMap` that opens a region into a finer map (world to country, country to
 * departments) with a breadcrumb back up. The map of each level only needs its own geometry, so
 * only levels the user opens are ever drawn. The path is announced politely to screen readers.
 */
export function ChoroplethDrilldown({
  title,
  root,
  resolve,
  breadcrumbLabel = "Map level",
  onNavigate,
  onRegionClick,
  className,
  ...mapProps
}: ChoroplethDrilldownProps) {
  const [path, setPath] = useState<readonly DrilldownLevel[]>([root]);
  const level = path[path.length - 1] ?? root;
  const go = (next: readonly DrilldownLevel[]) => {
    setPath(next);
    onNavigate?.(next);
  };
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <ChartBreadcrumb
        label={breadcrumbLabel}
        items={path.map((item) => ({ id: item.id, name: item.name }))}
        onSelect={(id) => {
          const index = path.findIndex((item) => item.id === id);
          if (index >= 0) go(path.slice(0, index + 1));
        }}
      />
      <span role="status" className="sr-only">
        {path.map((item) => item.name).join(" > ")}
      </span>
      <ChoroplethMap
        {...mapProps}
        key={level.id}
        title={`${title}: ${level.name}`}
        map={level.map}
        data={level.data}
        valueName={level.valueName ?? mapProps.valueName}
        valueFormat={level.valueFormat ?? mapProps.valueFormat}
        onRegionClick={(region) => {
          const next = resolve(region, path);
          if (next) go([...path, next]);
          else onRegionClick?.(region, path);
        }}
      />
    </div>
  );
}
