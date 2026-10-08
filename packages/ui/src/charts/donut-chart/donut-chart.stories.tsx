import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatCurrency } from "../core/format.js";
import { DonutChart } from "./donut-chart.js";

const services = [
  { id: "corte", name: "Corte clásico", value: 4200 },
  { id: "degradado", name: "Degradado", value: 3650 },
  { id: "corte-barba", name: "Corte + barba", value: 2980 },
  { id: "barba", name: "Perfilado de barba", value: 1450 },
  { id: "tinte", name: "Tinte", value: 920 },
  { id: "lavado", name: "Lavado y peinado", value: 380 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  total: "Total",
  explore: "Porciones del gráfico. Usa las flechas para recorrerlas.",
  category: "Servicio",
  value: "Ingresos",
  share: "Participación",
};

const meta = {
  title: "Charts/DonutChart",
  component: DonutChart,
  tags: ["autodocs"],
  args: {
    title: "Ingresos por servicio en octubre",
    data: services,
    valueFormat: "currency",
    variant: "donut",
    semi: false,
    innerRadius: 0.62,
    cornerRadius: 6,
    gap: 3,
    explode: 8,
    startAngle: 0,
    outsideLabels: false,
    height: 320,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["donut", "pie"] },
    semi: { control: "boolean" },
    innerRadius: { control: { type: "range", min: 0.3, max: 0.85, step: 0.01 } },
    cornerRadius: { control: { type: "range", min: 0, max: 20, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 12, step: 1 } },
    explode: { control: { type: "range", min: 0, max: 20, step: 1 } },
    startAngle: { control: { type: "range", min: -180, max: 180, step: 5 } },
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
} satisfies Meta<typeof DonutChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OutsideLabels: Story = {
  args: { outsideLabels: "both", height: 360, cornerRadius: 8 },
};

export const OutsidePercentOnly: Story = {
  args: { outsideLabels: "percent", legend: "top", gap: 5 },
};

export const SemiDonut: Story = {
  args: {
    title: "Citas por estado hoy",
    semi: true,
    height: 240,
    valueFormat: "integer",
    centerLabel: "Citas",
    data: [
      { id: "atendidas", name: "Atendidas", value: 18 },
      { id: "confirmadas", name: "Confirmadas", value: 9 },
      { id: "pendientes", name: "Pendientes", value: 6 },
      { id: "canceladas", name: "Canceladas", value: 2 },
    ],
    labels: { ...spanishLabels, value: "Citas" },
  },
};

export const SemiWithOutsideLabels: Story = {
  args: { ...SemiDonut.args, outsideLabels: true, height: 280 },
};

export const SharpThinRing: Story = {
  args: { innerRadius: 0.8, cornerRadius: 0, gap: 2, explode: 4 },
};

export const CustomCenter: Story = {
  args: {
    centerValue: formatCurrency(13580),
    centerLabel: "Facturado en octubre",
  },
};

export const HiddenSlices: Story = {
  args: { initialHidden: ["lavado", "tinte"] },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

/** 320 px container: outside labels give way to the legend, the centre text scales. */
export const Narrow: Story = {
  args: { outsideLabels: true, height: 300 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
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
