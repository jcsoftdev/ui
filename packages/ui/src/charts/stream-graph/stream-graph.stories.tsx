import type { Meta, StoryObj } from "@storybook/react-vite";
import { StreamGraph } from "./stream-graph.js";

const weeks = Array.from({ length: 26 }, (_, i) => new Date(2026, 3, 6 + i * 7));

const stream = (base: number, amp: number, phase: number, period: number) =>
  weeks.map((_, i) => Math.max(2, Math.round(base + amp * Math.sin(i / period + phase) + (i % 3))));

const services = [
  { id: "corte", name: "Corte clásico", data: stream(46, 18, 0, 3.4) },
  { id: "degradado", name: "Degradado", data: stream(38, 22, 1.6, 4.2) },
  { id: "barba", name: "Barba", data: stream(22, 10, 3.1, 2.8) },
  { id: "combo", name: "Corte + barba", data: stream(26, 14, 4.4, 5) },
  { id: "tinte", name: "Tinte", data: stream(9, 6, 2.2, 3.6) },
  { id: "facial", name: "Limpieza facial", data: stream(7, 4, 5.2, 4.4) },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore:
    "Flujos del gráfico. Flechas izquierda y derecha para el tiempo, arriba y abajo para cambiar de servicio.",
  brush: "Rango visible",
  category: "Semana",
};

const meta = {
  title: "Charts/StreamGraph",
  component: StreamGraph,
  tags: ["autodocs"],
  args: {
    title: "Servicios realizados por semana",
    categories: weeks,
    series: services,
    valueFormat: "integer",
    height: 340,
    offset: "wiggle",
    order: "inside-out",
    curve: "smooth",
    streamLabels: true,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    offset: { control: "inline-radio", options: ["wiggle", "silhouette", "zero", "expand"] },
    order: { control: "inline-radio", options: ["inside-out", "ascending", "none"] },
    curve: { control: "inline-radio", options: ["smooth", "linear"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    categories: { control: false },
    series: { control: false },
    valueFormat: { control: "select", options: ["number", "integer", "compact", "percent"] },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StreamGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Silhouette: Story = { args: { offset: "silhouette" } };

export const StackedFromZero: Story = {
  args: { offset: "zero", order: "none", title: "Servicios apilados desde cero" },
};

export const Share: Story = {
  args: { offset: "expand", valueFormat: "integer", title: "Participación de cada servicio" },
};

export const FewStreams: Story = { args: { series: services.slice(0, 3), streamLabels: true } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [{ id: "x", name: "Sin datos", data: [] }] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
