import type { Meta, StoryObj } from "@storybook/react-vite";
import { BulletChart } from "./bullet-chart.js";

const kpis = [
  {
    label: "Ingresos del mes",
    actual: 18400,
    target: 20000,
    ranges: [12000, 17000, 24000],
    format: "currency" as const,
  },
  {
    label: "Citas atendidas",
    actual: 412,
    target: 450,
    ranges: [300, 400, 520],
    format: "integer" as const,
  },
  {
    label: "Ocupación (%)",
    actual: 78,
    target: 85,
    ranges: [60, 80, 100],
    format: "integer" as const,
  },
  {
    label: "Satisfacción",
    actual: 4.7,
    target: 4.5,
    ranges: [3.5, 4.2, 5],
    format: "number" as const,
  },
  {
    label: "Clientes nuevos",
    actual: 63,
    target: 80,
    ranges: [40, 70, 100],
    format: "integer" as const,
  },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  total: "Total",
  explore: "Indicadores. Usa las flechas para recorrerlos.",
  category: "Indicador",
};

const meta = {
  title: "Charts/BulletChart",
  component: BulletChart,
  tags: ["autodocs"],
  args: {
    title: "Indicadores de la barbería en octubre",
    items: kpis,
    rangeLabels: ["Bajo", "Aceptable", "Bueno"],
    actualLabel: "Actual",
    targetLabel: "Meta",
    orientation: "horizontal",
    scale: "row",
    rowHeight: 46,
    valueLabels: true,
    legend: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    scale: { control: "inline-radio", options: ["row", "shared"] },
    rowHeight: { control: { type: "range", min: 30, max: 80, step: 2 } },
    items: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BulletChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = { args: { orientation: "vertical", height: 320 } };

/** Same units for every row: one axis, one scale. */
export const SharedScale: Story = {
  args: {
    title: "Citas por barbero contra su cupo semanal",
    items: [
      { label: "Mateo", actual: 38, target: 40, ranges: [25, 35, 50] },
      { label: "Valeria", actual: 29, target: 40, ranges: [25, 35, 50] },
      { label: "Diego", actual: 44, target: 40, ranges: [25, 35, 50] },
      { label: "Camila", actual: 21, target: 30, ranges: [25, 35, 50] },
    ],
    scale: "shared",
    valueLabels: true,
  },
};

export const WithoutTarget: Story = {
  args: {
    title: "Ocupación por sede (%)",
    items: [
      { label: "Miraflores", actual: 82, ranges: [50, 75, 100] },
      { label: "San Isidro", actual: 64, ranges: [50, 75, 100] },
      { label: "Surco", actual: 41, ranges: [50, 75, 100] },
    ],
    legend: true,
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

export const NarrowVertical: Story = {
  args: { orientation: "vertical", height: 320 },
  decorators: Narrow.decorators,
};

/** Drag the corner: the chart fills the box exactly. */
export const FillParent: Story = {
  args: { height: "fill", orientation: "vertical" },
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
