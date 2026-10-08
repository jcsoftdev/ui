import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ValueFormat } from "../core/format.js";
import { GaugeChart } from "./gauge-chart.js";

const percentFormat: ValueFormat = (v) => `${Math.round(v)}%`;

const occupancyBands = [
  { from: 0, to: 40, label: "Baja", tone: "danger" as const },
  { from: 40, to: 70, label: "Media", tone: "warning" as const },
  { from: 70, to: 100, label: "Óptima", tone: "success" as const },
];

const spanishLabels = {
  empty: "Sin datos",
  loading: "Cargando gráfico",
  explore: "Rangos del indicador. Usa las flechas para recorrerlos.",
  category: "Rango",
  value: "Valor actual",
};

const meta = {
  title: "Charts/GaugeChart",
  component: GaugeChart,
  tags: ["autodocs"],
  args: {
    title: "Ocupación de sillas",
    label: "Ocupación de sillas",
    value: 76,
    min: 0,
    max: 100,
    variant: "semi",
    mode: "progress",
    ranges: occupancyBands,
    thickness: 18,
    roundedCaps: true,
    ticks: 0,
    minMaxLabels: true,
    valueFormat: percentFormat as ValueFormat,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
    variant: { control: "inline-radio", options: ["semi", "three-quarter"] },
    mode: { control: "inline-radio", options: ["progress", "needle"] },
    thickness: { control: { type: "range", min: 6, max: 40, step: 1 } },
    ticks: { control: { type: "range", min: 0, max: 10, step: 1 } },
    roundedCaps: { control: "boolean" },
    minMaxLabels: { control: "boolean" },
    height: { control: { type: "range", min: 160, max: 480, step: 10 } },
    ranges: { control: false },
    valueFormat: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GaugeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Needle: Story = {
  args: { mode: "needle", ticks: 5, thickness: 22, roundedCaps: false, value: 58 },
};

export const ThreeQuarter: Story = { args: { variant: "three-quarter", value: 34 } };

export const ThreeQuarterNeedle: Story = {
  args: { variant: "three-quarter", mode: "needle", ticks: 4, value: 88 },
};

export const NoBands: Story = {
  args: {
    title: "Meta de ventas de hoy",
    label: "de S/ 1 500",
    ranges: undefined,
    value: 1180,
    max: 1500,
    valueFormat: "currency",
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { value: Number.NaN } };

/** 320 px container: the arc and value scale to the container. */
export const Narrow: Story = {
  args: { mode: "needle", ticks: 4 },
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
