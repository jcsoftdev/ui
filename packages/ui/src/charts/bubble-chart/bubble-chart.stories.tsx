import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatNumber, formatPercent, type ValueFormat } from "../core/format.js";
import { BubbleChart } from "./bubble-chart.js";

const minutes = (value: number) => `${formatNumber(value, { maximumFractionDigits: 0 })} min`;

// x: duración media, y: ticket promedio, size: servicios del mes.
const services = [
  { label: "Corte clásico", x: 28, y: 35, size: 186 },
  { label: "Degradado", x: 38, y: 45, size: 142 },
  { label: "Corte + barba", x: 52, y: 60, size: 97 },
  { label: "Barba", x: 18, y: 25, size: 74 },
  { label: "Tinte", x: 65, y: 90, size: 31 },
  { label: "Lavado", x: 12, y: 15, size: 22 },
];

const branches = [
  {
    id: "miraflores",
    name: "Miraflores",
    points: [
      { label: "Kevin", x: 4.8, y: 52, size: 310 },
      { label: "Renzo", x: 4.3, y: 44, size: 260 },
      { label: "Abel", x: 4.9, y: 58, size: 190 },
    ],
  },
  {
    id: "surco",
    name: "Surco",
    points: [
      { label: "Diego", x: 3.9, y: 38, size: 240 },
      { label: "Luis", x: 4.6, y: 47, size: 170 },
      { label: "Marco", x: 3.6, y: 34, size: 120 },
    ],
  },
];

const spanishLabels = {
  empty: "Sin servicios en este periodo",
  loading: "Cargando gráfico",
  explore: "Burbujas del gráfico. Usa las flechas para recorrerlas.",
  size: "Servicios",
  series: "Sede",
  point: "Servicio",
};

const meta = {
  title: "Charts/BubbleChart",
  component: BubbleChart,
  tags: ["autodocs"],
  args: {
    title: "Servicios: duración, ticket y volumen",
    series: [{ id: "servicios", name: "Servicios", points: services }],
    xFormat: minutes as ValueFormat,
    yFormat: "currency",
    sizeFormat: "integer",
    xAxis: { title: "Duración media (min)" },
    yAxis: { title: "Ticket (S/)" },
    sizeRange: [4, 34],
    showLabels: true,
    sizeLegend: true,
    trendLine: false,
    height: 360,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 220, max: 560, step: 10 } },
    xFormat: { control: false },
    yFormat: { control: false },
    sizeFormat: { control: false },
    series: { control: false },
    quadrants: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BubbleChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BarbersByBranch: Story = {
  args: {
    title: "Barberos: calificación, ticket y clientes atendidos",
    series: branches,
    xFormat: (value: number) => formatNumber(value, { maximumFractionDigits: 1 }),
    xAxis: { title: "Calificación", min: 3.4, max: 5 },
    yAxis: { title: "Ticket (S/)" },
    labels: { ...spanishLabels, size: "Clientes", point: "Barbero" },
  },
};

export const WithQuadrants: Story = {
  args: {
    title: "Rentabilidad de servicios",
    quadrants: {
      labels: { topRight: "Largos y rentables", bottomLeft: "Rápidos y económicos" },
      tones: { topRight: "success" },
    },
    sizeFormat: (value: number) => formatPercent(value / 552),
    labels: { ...spanishLabels, size: "Participación" },
  },
};

export const WithoutLabels: Story = { args: { showLabels: false, sizeLegend: false } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { series: [{ id: "servicios", name: "Servicios", points: [] }] },
};
