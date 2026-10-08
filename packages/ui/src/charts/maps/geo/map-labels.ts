import { type ChartLabels, DEFAULT_LABELS } from "../../core/types.js";

/** Visible strings of the maps. English defaults; pass Spanish (or any language) from the app. */
export interface MapLabels extends ChartLabels {
  zoomIn: string;
  zoomOut: string;
  /** Button that fits the whole map again. */
  fit: string;
  /** Accessible name of the zoom button group. */
  controls: string;
  /** Tooltip value and table cell of a region without data. */
  noData: string;
  /** Header of the region column in the hidden data table. */
  region: string;
  /** Header of the longitude / latitude columns of a marker table. */
  longitude: string;
  latitude: string;
  /** Spoken and tooltip name of a cluster, e.g. "Grupo de 4". Receives the member count. */
  cluster: (count: number) => string;
  /** Spoken hint appended to the explore label. */
  zoomHint: string;
  /** Route table headers (BubbleMap routes). */
  origin: string;
  destination: string;
  /** Name of the routes layer, e.g. "Routes". */
  routes: string;
  /** Visible data table: the toggle buttons and the "Share" bar column. */
  showTable: string;
  showMap: string;
  /** Accessible name of the sortable column buttons: receives the column name. */
  sortBy: (column: string) => string;
}

export const DEFAULT_MAP_LABELS: MapLabels = {
  ...DEFAULT_LABELS,
  empty: "No map data to show",
  loading: "Loading map",
  explore:
    "Map regions. Use the arrow keys to move between them, plus and minus to zoom, zero to fit.",
  region: "Region",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit the whole map",
  controls: "Map zoom",
  noData: "No data",
  longitude: "Longitude",
  latitude: "Latitude",
  cluster: (count) => `Group of ${count}`,
  zoomHint: "Plus and minus zoom, zero fits the map.",
  origin: "Origin",
  destination: "Destination",
  routes: "Routes",
  showTable: "View as table",
  showMap: "View as map",
  sortBy: (column) => `Sort by ${column}`,
};

export function resolveMapLabels(labels?: Partial<MapLabels>): MapLabels {
  return labels ? { ...DEFAULT_MAP_LABELS, ...labels } : DEFAULT_MAP_LABELS;
}
