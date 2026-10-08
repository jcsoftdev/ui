import type { Meta, StoryObj } from "@storybook/react-vite";
import { PolarAreaChart } from "./polar-area-chart.js";

const weekday = [
  { id: "lun", name: "Lunes", value: 18 },
  { id: "mar", name: "Martes", value: 24 },
  { id: "mie", name: "Miércoles", value: 27 },
  { id: "jue", name: "Jueves", value: 33 },
  { id: "vie", name: "Viernes", value: 46 },
  { id: "sab", name: "Sábado", value: 58 },
  { id: "dom", name: "Domingo", value: 12 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  explore: "Sectores del gráfico. Usa las flechas para recorrerlos.",
  category: "Día",
  value: "Citas",
  share: "Participación",
};

const meta = {
  title: "Charts/PolarAreaChart",
  component: PolarAreaChart,
  tags: ["autodocs"],
  args: {
    title: "Citas por día de la semana",
    data: weekday,
    scale: "radius",
    innerRadius: 0.1,
    cornerRadius: 4,
    gap: 3,
    levels: 4,
    showLabels: true,
    startAngle: 0,
    valueFormat: "integer",
    height: 380,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    scale: { control: "inline-radio", options: ["radius", "area"] },
    innerRadius: { control: { type: "range", min: 0, max: 0.5, step: 0.01 } },
    cornerRadius: { control: { type: "range", min: 0, max: 16, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 12, step: 1 } },
    levels: { control: { type: "range", min: 2, max: 8, step: 1 } },
    monochrome: { control: "boolean" },
    startAngle: { control: { type: "range", min: -90, max: 90, step: 5 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 240, max: 560, step: 10 } },
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
} satisfies Meta<typeof PolarAreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NightingaleArea: Story = {
  args: { scale: "area", title: "Citas por día (área proporcional)" },
};

export const WithHole: Story = { args: { innerRadius: 0.3, cornerRadius: 8 } };

/** One hue in shades: the longest sector is the darkest. */
export const Monochrome: Story = { args: { monochrome: true, scale: "area" } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

/** 320 px container: rim labels hide and the legend names the sectors. */
export const Narrow: Story = {
  args: { height: 320 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
