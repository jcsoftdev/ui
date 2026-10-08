import type { Meta, StoryObj } from "@storybook/react-vite";
import { SlopeChart } from "./slope-chart.js";

const servicios = [
  { label: "Corte clásico", from: 182, to: 214 },
  { label: "Degradado", from: 140, to: 171 },
  { label: "Barba", from: 96, to: 88 },
  { label: "Corte + barba", from: 74, to: 112 },
  { label: "Tinte", from: 31, to: 29 },
  { label: "Limpieza facial", from: 30, to: 35 },
  { label: "Corte infantil", from: 58, to: 63 },
  { label: "Perfilado de cejas", from: 28, to: 33 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Servicio",
};

const meta = {
  title: "Charts/SlopeChart",
  component: SlopeChart,
  tags: ["autodocs"],
  args: {
    title: "Citas por servicio: septiembre contra octubre",
    items: servicios,
    fromLabel: "Septiembre",
    toLabel: "Octubre",
    colorBy: "direction",
    lowerIsBetter: false,
    valueFormat: "integer",
    tooltip: true,
    loading: false,
    animate: true,
    deltaLabel: "Cambio",
    labels: spanishLabels,
  },
  argTypes: {
    colorBy: { control: "inline-radio", options: ["direction", "series"] },
    valueFormat: { control: "select", options: ["number", "integer", "currency", "compact"] },
    items: { control: false },
    height: { control: { type: "range", min: 220, max: 640, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SlopeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SeriesColors: Story = { args: { colorBy: "series" } };

export const CrowdedLabels: Story = {
  args: {
    title: "Valores muy cercanos: las etiquetas se separan",
    items: [
      { label: "Mateo", from: 100, to: 104 },
      { label: "Valeria", from: 101, to: 103 },
      { label: "Diego", from: 102, to: 101 },
      { label: "Camila", from: 103, to: 109 },
      { label: "Andrea", from: 104, to: 100 },
      { label: "Bruno", from: 99, to: 102 },
    ],
  },
};

export const Revenue: Story = {
  args: {
    title: "Ingresos por barbero",
    items: [
      { label: "Mateo", from: 4200, to: 4880 },
      { label: "Valeria", from: 5100, to: 4650 },
      { label: "Diego", from: 3300, to: 3920 },
      { label: "Camila", from: 2800, to: 2790 },
    ],
    valueFormat: "currency",
  },
};

export const LowerIsBetter: Story = {
  args: {
    title: "Cancelaciones por barbero",
    lowerIsBetter: true,
    items: [
      { label: "Mateo", from: 14, to: 9 },
      { label: "Valeria", from: 6, to: 11 },
      { label: "Diego", from: 10, to: 10 },
      { label: "Camila", from: 8, to: 5 },
    ],
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { items: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
