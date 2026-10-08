import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadialBarChart } from "./radial-bar-chart.js";

const activity = [
  { id: "citas", name: "Citas", value: 24, max: 30 },
  { id: "ingresos", name: "Ingresos", value: 1180, max: 1500, format: "currency" as const },
  {
    id: "ocupacion",
    name: "Ocupación",
    value: 72,
    max: 100,
    format: (v: number) => `${Math.round(v)}%`,
  },
  {
    id: "puntualidad",
    name: "Puntualidad",
    value: 91,
    max: 100,
    format: (v: number) => `${Math.round(v)}%`,
  },
];

const spanishLabels = {
  empty: "Sin datos para hoy",
  loading: "Cargando gráfico",
  explore: "Anillos del gráfico. Usa las flechas para recorrerlos.",
  category: "Indicador",
  value: "Valor",
  share: "Avance",
};

const meta = {
  title: "Charts/RadialBarChart",
  component: RadialBarChart,
  tags: ["autodocs"],
  args: {
    title: "Actividad del día",
    data: activity,
    max: 100,
    startAngle: 0,
    endAngle: 270,
    gap: 6,
    track: true,
    roundedCaps: true,
    gradient: true,
    height: 340,
    centerValue: "80%",
    centerLabel: "de la meta diaria",
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    startAngle: { control: { type: "range", min: -180, max: 180, step: 5 } },
    endAngle: { control: { type: "range", min: 90, max: 360, step: 5 } },
    thickness: { control: { type: "range", min: 6, max: 40, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 16, step: 1 } },
    track: { control: "boolean" },
    roundedCaps: { control: "boolean" },
    gradient: { control: "boolean" },
    ringLabels: { control: "boolean" },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 220, max: 560, step: 10 } },
    data: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadialBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FullCircle: Story = {
  args: { endAngle: 360, ringLabels: false, centerValue: "4 de 4", centerLabel: "metas" },
};

export const SolidSharp: Story = {
  args: { gradient: false, roundedCaps: false, track: true, thickness: 18 },
};

export const SingleRing: Story = {
  args: {
    title: "Meta de ventas del mes",
    data: [{ id: "meta", name: "Ventas", value: 18400, max: 25000, format: "currency" }],
    endAngle: 360,
    ringLabels: false,
    centerValue: "74%",
    centerLabel: "de S/ 25 000",
    height: 280,
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

/** 320 px container: ring labels hide (the legend names the rings) and the rings scale down. */
export const Narrow: Story = {
  args: { height: 300 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
