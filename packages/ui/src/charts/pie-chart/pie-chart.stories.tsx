import type { Meta, StoryObj } from "@storybook/react-vite";
import { PieChart } from "./pie-chart.js";

const payments = [
  { id: "yape", name: "Yape", value: 5400 },
  { id: "efectivo", name: "Efectivo", value: 3900 },
  { id: "tarjeta", name: "Tarjeta", value: 2850 },
  { id: "plin", name: "Plin", value: 1250 },
  { id: "transferencia", name: "Transferencia", value: 480 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  explore: "Porciones del gráfico. Usa las flechas para recorrerlas.",
  category: "Medio de pago",
  value: "Monto",
  share: "Participación",
};

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas por medio de pago",
    data: payments,
    valueFormat: "currency",
    semi: false,
    cornerRadius: 8,
    gap: 3,
    explode: 10,
    outsideLabels: false,
    height: 320,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    semi: { control: "boolean" },
    cornerRadius: { control: { type: "range", min: 0, max: 24, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 12, step: 1 } },
    explode: { control: { type: "range", min: 0, max: 24, step: 1 } },
    outsideLabels: { control: "select", options: [false, true, "name", "percent", "both"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 200, max: 520, step: 10 } },
    data: { control: false },
    onSliceClick: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OutsideLabels: Story = { args: { outsideLabels: "both", height: 360 } };

export const SemiPie: Story = { args: { semi: true, height: 260, outsideLabels: "name" } };

export const SharpNoGap: Story = { args: { cornerRadius: 0, gap: 0, explode: 6 } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

/** 320 px container: labels are replaced by the legend. */
export const Narrow: Story = {
  args: { outsideLabels: true, height: 280 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
