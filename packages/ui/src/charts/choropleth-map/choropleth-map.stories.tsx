import type { Meta, StoryObj } from "@storybook/react-vite";
import { peruMap } from "../maps/data/peru/index.js";
import { worldMap } from "../maps/data/world/index.js";
import type { MapLabels } from "../maps/geo/map-labels.js";
import { ChoroplethDrilldown, type DrilldownLevel } from "./choropleth-drilldown.js";
import { type ChoroplethDatum, ChoroplethMap } from "./choropleth-map.js";

/** Clientes registrados por departamento: Lima concentra casi todo, el resto sigue la costa y los Andes. */
const customers: ChoroplethDatum[] = [
  { id: "PE-LMA", value: 2400 },
  { id: "PE-LIM", value: 610 },
  { id: "PE-CAL", value: 940 },
  { id: "PE-ARE", value: 760 },
  { id: "PE-LAL", value: 690 },
  { id: "PE-PIU", value: 540 },
  { id: "PE-CUS", value: 520 },
  { id: "PE-LAM", value: 410 },
  { id: "PE-JUN", value: 380 },
  { id: "PE-ICA", value: 350 },
  { id: "PE-ANC", value: 310 },
  { id: "PE-CAJ", value: 270 },
  { id: "PE-PUN", value: 240 },
  { id: "PE-TAC", value: 190 },
  { id: "PE-SAM", value: 180 },
  { id: "PE-LOR", value: 170 },
  { id: "PE-HUC", value: 140 },
  { id: "PE-AYA", value: 130 },
  { id: "PE-UCA", value: 120 },
  { id: "PE-TUM", value: 115 },
  { id: "PE-MOQ", value: 110 },
  { id: "PE-APU", value: 80 },
  { id: "PE-AMA", value: 70 },
  { id: "PE-PAS", value: 60 },
  { id: "PE-HUV", value: 55 },
  { id: "PE-MDD", value: 40 },
];

/** Variación anual de clientes (%) por departamento; unos pocos retroceden. */
const growth: ChoroplethDatum[] = customers.map((datum, index) => ({
  id: datum.id,
  value: Math.round(((index * 37) % 41) - 12),
}));

const withGaps: ChoroplethDatum[] = customers.filter((_, index) => index % 6 !== 5);

/** Visitas a la marca por país, en miles. */
const visits: ChoroplethDatum[] = [
  ["PER", 940],
  ["ARG", 420],
  ["BRA", 780],
  ["CHL", 360],
  ["COL", 510],
  ["MEX", 690],
  ["USA", 1320],
  ["CAN", 240],
  ["ESP", 560],
  ["FRA", 310],
  ["DEU", 330],
  ["ITA", 270],
  ["GBR", 380],
  ["JPN", 200],
  ["CHN", 150],
  ["IND", 120],
  ["AUS", 140],
  ["ZAF", 60],
  ["EGY", 45],
  ["BOL", 130],
  ["ECU", 220],
  ["URY", 90],
  ["VEN", 100],
  ["PRY", 55],
].map(([id, value]) => ({ id: id as string, value: value as number }));

const spanishLabels: Partial<MapLabels> = {
  empty: "Sin datos para este mapa",
  loading: "Cargando mapa",
  explore:
    "Regiones del mapa. Usa las flechas para moverte entre ellas, más y menos para acercar, cero para ver todo.",
  region: "Departamento",
  value: "Valor",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  fit: "Ver todo el mapa",
  controls: "Zoom del mapa",
  noData: "Sin datos",
  showTable: "Ver como tabla",
  showMap: "Ver como mapa",
  sortBy: (column) => `Ordenar por ${column}`,
  share: "Proporción",
};

const meta = {
  title: "Charts/ChoroplethMap",
  component: ChoroplethMap,
  tags: ["autodocs"],
  args: {
    title: "Clientes por departamento",
    map: peruMap,
    data: customers,
    valueName: "Clientes",
    valueFormat: "integer",
    scale: "sequential",
    regionLabels: "none",
    dataTable: "hidden",
    legend: true,
    tooltip: true,
    zoomable: true,
    wheelZoom: "always",
    maxZoom: 16,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    scale: { control: "inline-radio", options: ["sequential", "diverging"] },
    regionLabels: { control: "inline-radio", options: ["none", "name", "value"] },
    dataTable: { control: "inline-radio", options: ["hidden", "visible", "toggle"] },
    wheelZoom: { control: "inline-radio", options: ["always", "modifier"] },
    projection: {
      control: "select",
      options: [undefined, "fitted", "equirectangular", "mercator", "equalEarth"],
    },
    height: { control: { type: "range", min: 220, max: 720, step: 10 } },
    maxZoom: { control: { type: "range", min: 2, max: 24, step: 1 } },
    map: { control: false },
    data: { control: false },
    ranges: { control: false },
    colors: { control: false },
    valueFormat: { control: false },
    onRegionClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChoroplethMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Peru por departamento. Pasa el cursor, usa las flechas, haz zoom con la rueda, los botones o + y -, arrastra para mover. */
export const Default: Story = {
  args: { height: 520 },
};

export const RegionLabels: Story = {
  args: { regionLabels: "name", height: 620 },
};

export const Diverging: Story = {
  args: {
    title: "Variación anual de clientes",
    data: growth,
    scale: "diverging",
    center: 0,
    valueName: "Variación",
    valueFormat: (value: number) => `${value > 0 ? "+" : ""}${value}%`,
    regionLabels: "value",
    height: 620,
  },
};

export const Thresholds: Story = {
  args: {
    title: "Nivel de cobertura por departamento",
    height: 520,
    ranges: [
      { to: 100, label: "Baja (menos de 100)", tone: "neutral" },
      { from: 100, to: 400, label: "Media", tone: "success" },
      { from: 400, to: 1000, label: "Alta", tone: "warning" },
      { from: 1000, label: "Muy alta (1 000 o más)", tone: "danger" },
    ],
  },
};

export const MissingData: Story = {
  args: { title: "Clientes (sin reporte en algunos departamentos)", data: withGaps, height: 520 },
};

export const World: Story = {
  args: {
    title: "Visitas por país",
    map: worldMap,
    data: visits,
    valueName: "Visitas (miles)",
    height: undefined,
    wheelZoom: "modifier",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 880, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export const WorldMercator: Story = {
  ...World,
  args: { ...World.args, projection: "mercator" },
};

const worldLevel: DrilldownLevel = {
  id: "mundo",
  name: "Mundo",
  map: worldMap,
  data: visits,
  valueName: "Visitas (miles)",
};

const peruLevel: DrilldownLevel = {
  id: "peru",
  name: "Perú",
  map: peruMap,
  data: customers,
  valueName: "Clientes",
};

/**
 * Haz clic en Perú para abrir sus departamentos; la miga de pan vuelve al mundo. Solo hay
 * geometría de detalle para Perú, así que el resto de países no se abre.
 */
export const Drilldown: Story = {
  args: { title: "Marca por territorio", height: 460, wheelZoom: "modifier" },
  render: ({ map: _map, data: _data, ...args }) => (
    <ChoroplethDrilldown
      {...args}
      root={worldLevel}
      breadcrumbLabel="Nivel del mapa"
      resolve={(region) => (region.id === "PER" ? peruLevel : null)}
    />
  ),
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

/** Accessible alternative to color: the same numbers as a sortable table, with a bar for the magnitude. */
export const DataTable: Story = {
  args: { dataTable: "visible", height: 480 },
};

/** A button switches between the map and its table; keyboard and screen reader users get the table either way. */
export const DataTableToggle: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { dataTable: "toggle", height: 480 },
};

export const DataTableNarrow: Story = {
  args: { dataTable: "visible", height: 420 },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: { loading: true, height: 360 },
};

export const Empty: Story = {
  args: { data: [], height: 360 },
};

/** 320 px container: legend below, labels only where they fit, zoom buttons stay reachable. */
export const Narrow: Story = {
  args: { regionLabels: "name" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the map fits the box exactly, width and height. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 460,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};
