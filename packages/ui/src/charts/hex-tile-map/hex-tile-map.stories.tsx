import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ChoroplethDatum } from "../choropleth-map/choropleth-map.js";
import type { MapLabels } from "../maps/geo/map-labels.js";
import { HexTileMap } from "./hex-tile-map.js";

/** Clientes por departamento; Lima suma el área metropolitana y el resto del departamento. */
const customers: ChoroplethDatum[] = [
  { id: "PE-LIM", value: 3010 },
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

/** Variación anual de clientes (%) por departamento. */
const growth: ChoroplethDatum[] = customers.map((datum, index) => ({
  id: datum.id,
  value: ((index * 37) % 41) - 12,
}));

const spanishLabels: Partial<MapLabels> = {
  empty: "Sin datos para este mapa",
  loading: "Cargando mapa",
  explore:
    "Departamentos del Perú como hexágonos. Usa las flechas para moverte entre ellos y Enter para abrir uno.",
  region: "Departamento",
  value: "Valor",
  noData: "Sin datos",
};

const meta = {
  title: "Charts/HexTileMap",
  component: HexTileMap,
  tags: ["autodocs"],
  args: {
    title: "Clientes por departamento",
    data: customers,
    valueName: "Clientes",
    valueFormat: "integer",
    scale: "sequential",
    tileLabels: "both",
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    scale: { control: "inline-radio", options: ["sequential", "diverging"] },
    tileLabels: { control: "inline-radio", options: ["code", "value", "both", "none"] },
    height: { control: { type: "range", min: 220, max: 720, step: 10 } },
    data: { control: false },
    tiles: { control: false },
    ranges: { control: false },
    colors: { control: false },
    valueFormat: { control: false },
    onTileClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HexTileMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Los 25 departamentos como hexágonos del mismo tamaño: Callao pesa lo mismo que Loreto. */
export const Default: Story = {};

export const Diverging: Story = {
  args: {
    title: "Variación anual de clientes (%)",
    data: growth,
    scale: "diverging",
    valueName: "Variación",
    valueFormat: "percent",
  },
};

export const Thresholds: Story = {
  args: {
    ranges: [
      { to: 150, label: "Menos de 150", tone: "neutral" },
      { from: 150, to: 500, label: "150 a 500", tone: "warning" },
      { from: 500, label: "Más de 500", tone: "success" },
    ],
  },
};

export const Loading: Story = { args: { loading: true, height: 320 } };

export const Empty: Story = { args: { data: [], height: 320 } };

/** 320 px container: the grid shrinks to fit, labels keep the code and drop the value. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the hexagons fill the box as far as the grid's proportions allow. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 440,
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
