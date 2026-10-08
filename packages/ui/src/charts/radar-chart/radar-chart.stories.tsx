import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadarChart } from "./radar-chart.js";

const skills = ["Corte", "Degradado", "Barba", "Atención", "Puntualidad", "Limpieza"];

const barbers = [
  { id: "kevin", name: "Kevin", data: [92, 88, 70, 85, 90, 78] },
  { id: "renzo", name: "Renzo", data: [75, 95, 82, 70, 65, 88] },
  { id: "abel", name: "Abel", data: [60, 72, 94, 90, 80, 68] },
];

const spanishLabels = {
  empty: "Sin datos",
  loading: "Cargando gráfico",
  explore: "Ejes del radar. Usa las flechas para recorrerlos.",
  category: "Habilidad",
};

const meta = {
  title: "Charts/RadarChart",
  component: RadarChart,
  tags: ["autodocs"],
  args: {
    title: "Evaluación de barberos por habilidad",
    axes: skills,
    series: barbers,
    valueFormat: "integer",
    levels: 4,
    gridShape: "polygon",
    fill: true,
    fillOpacity: 0.18,
    markers: true,
    showValues: true,
    startAngle: 0,
    height: 380,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    gridShape: { control: "inline-radio", options: ["polygon", "circle"] },
    levels: { control: { type: "range", min: 2, max: 8, step: 1 } },
    fillOpacity: { control: { type: "range", min: 0, max: 0.6, step: 0.02 } },
    startAngle: { control: { type: "range", min: -90, max: 90, step: 5 } },
    max: { control: { type: "number" } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 240, max: 560, step: 10 } },
    axes: { control: false },
    series: { control: false },
    labels: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CircularGrid: Story = { args: { gridShape: "circle", fillOpacity: 0.12 } };

export const SingleSeries: Story = {
  args: {
    title: "Perfil de Kevin",
    series: [barbers[0] as (typeof barbers)[number]],
    fillOpacity: 0.28,
    max: 100,
  },
};

export const OutlineOnly: Story = { args: { fill: false, markers: true, showValues: false } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [] } };

/** 320 px container: axis names shorten and the plot shrinks to fit. */
export const Narrow: Story = {
  args: { height: 340 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
};
