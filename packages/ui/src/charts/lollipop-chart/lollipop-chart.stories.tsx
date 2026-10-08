import type { Meta, StoryObj } from "@storybook/react-vite";
import { LollipopChart } from "./lollipop-chart.js";

const services = [
  { label: "Corte clásico", value: 186 },
  { label: "Degradado", value: 142 },
  { label: "Corte + barba", value: 97 },
  { label: "Perfilado de barba", value: 74 },
  { label: "Tinte", value: 31 },
  { label: "Lavado y peinado", value: 22 },
  { label: "Limpieza facial", value: 18 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  total: "Total",
  explore: "Servicios. Usa las flechas para recorrerlos.",
  category: "Servicio",
};

const meta = {
  title: "Charts/LollipopChart",
  component: LollipopChart,
  tags: ["autodocs"],
  args: {
    title: "Servicios más vendidos en octubre",
    seriesName: "Vendidos",
    items: services,
    orientation: "horizontal",
    sort: "none",
    valueFormat: "integer",
    dotSize: 7,
    dataLabels: true,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    sort: { control: "inline-radio", options: ["none", "desc", "asc"] },
    valueFormat: { control: "select", options: ["number", "integer", "currency", "compact"] },
    dotSize: { control: { type: "range", min: 3, max: 12, step: 1 } },
    items: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LollipopChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = { args: { orientation: "vertical", height: 320 } };

export const Sorted: Story = {
  args: { items: [...services].reverse(), sort: "desc" },
};

export const NegativeValues: Story = {
  args: {
    title: "Variación de citas contra el mes pasado",
    seriesName: "Variación",
    items: [
      { label: "Mateo", value: 12, color: "var(--chart-up)" },
      { label: "Valeria", value: -8, color: "var(--chart-down)" },
      { label: "Diego", value: 21, color: "var(--chart-up)" },
      { label: "Camila", value: -2, color: "var(--chart-down)" },
      { label: "Renzo", value: 5, color: "var(--chart-up)" },
    ],
    valueFormat: (value: number) => `${value > 0 ? "+" : ""}${value}`,
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { items: [] } };

/** Drag the corner: the chart fills the box exactly. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 360,
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

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
