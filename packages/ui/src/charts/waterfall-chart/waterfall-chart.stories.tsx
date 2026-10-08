import type { Meta, StoryObj } from "@storybook/react-vite";
import { WaterfallChart } from "./waterfall-chart.js";

const cajaDelDia = [
  { label: "Apertura", value: 300, type: "start" as const },
  { label: "Cortes", value: 1240 },
  { label: "Barbas", value: 480 },
  { label: "Productos", value: 360 },
  { label: "Subtotal ventas", type: "subtotal" as const },
  { label: "Gastos", value: -420 },
  { label: "Adelantos", value: -350 },
  { label: "Propinas", value: 160 },
  { label: "Cierre", type: "total" as const },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Importe",
  explore: "Pasos de la caja. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Concepto",
};

const meta = {
  title: "Charts/WaterfallChart",
  component: WaterfallChart,
  tags: ["autodocs"],
  args: {
    title: "Caja del día: de la apertura al cierre",
    steps: cajaDelDia,
    valueFormat: "currency",
    height: 320,
    connectors: true,
    dataLabels: true,
    grid: true,
    legend: true,
    tooltip: true,
    loading: false,
    animate: true,
    increaseLabel: "Ingreso",
    decreaseLabel: "Egreso",
    totalLabel: "Saldo",
    runningLabel: "Acumulado",
    labels: spanishLabels,
  },
  argTypes: {
    valueFormat: { control: "select", options: ["number", "integer", "currency", "compact"] },
    steps: { control: false },
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WaterfallChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutConnectors: Story = { args: { connectors: false, dataLabels: false } };

export const NegativeBalance: Story = {
  args: {
    title: "Mes con pérdida: ventas contra costos",
    steps: [
      { label: "Ventas", value: 4200, type: "start" },
      { label: "Alquiler", value: -2400 },
      { label: "Sueldos", value: -1800 },
      { label: "Insumos", value: -950 },
      { label: "Servicios", value: -420 },
      { label: "Resultado", type: "total" },
    ],
  },
};

export const Horizontal: Story = {
  args: { orientation: "horizontal", height: 380 },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { steps: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Drag the corner: the chart fills the box exactly, width and height. */
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
