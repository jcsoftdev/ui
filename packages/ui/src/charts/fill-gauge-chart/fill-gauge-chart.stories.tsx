import type { Meta, StoryObj } from "@storybook/react-vite";
import { FillGaugeChart } from "./fill-gauge-chart.js";

const stock = [
  { id: "shampoo", name: "Shampoo", value: 18, max: 24 },
  { id: "aceite", name: "Aceite de barba", value: 5, max: 20 },
  { id: "aftershave", name: "Aftershave", value: 11, max: 12 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Producto",
};

const meta = {
  title: "Charts/FillGaugeChart",
  component: FillGaugeChart,
  tags: ["autodocs"],
  args: {
    title: "Stock de productos (unidades)",
    data: stock,
    shape: "bottle",
    level: "wave",
    minItemWidth: 104,
    height: 200,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    shape: {
      control: "select",
      options: ["bottle", "droplet", "battery", "person", "target", "shield", "chair", "star"],
    },
    level: { control: "inline-radio", options: ["wave", "flat"] },
    height: { control: { type: "range", min: 100, max: 400, step: 10 } },
    minItemWidth: { control: { type: "range", min: 60, max: 240, step: 4 } },
    data: { control: false },
    valueFormat: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FillGaugeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Droplet: Story = {
  args: {
    title: "Agua del tanque",
    data: [{ id: "tanque", name: "Tanque", value: 0.64 }],
    shape: "droplet",
    height: 220,
  },
};

export const Battery: Story = {
  name: "Battery (fills sideways)",
  args: {
    title: "Capacidad usada hoy por barbero",
    data: [
      { id: "kevin", name: "Kevin", value: 88, color: "var(--success)" },
      { id: "renzo", name: "Renzo", value: 54, color: "var(--warning)" },
      { id: "abel", name: "Abel", value: 21, color: "var(--danger)" },
    ],
    shape: "battery",
    max: 100,
    height: 160,
    labels: { ...spanishLabels, category: "Barbero" },
  },
};

export const MixedShapes: Story = {
  name: "Mixed shapes (person, target, shield)",
  args: {
    title: "Metas del mes",
    data: [
      { id: "clientes", name: "Clientes nuevos", value: 0.72, shape: "person" },
      { id: "ventas", name: "Meta de ventas", value: 0.91, shape: "target" },
      { id: "fidelidad", name: "Retención", value: 0.58, shape: "shield" },
    ],
    labels: { ...spanishLabels, category: "Meta" },
  },
};

export const RawValues: Story = {
  name: "Raw value labels, flat level",
  args: {
    level: "flat",
    valueFormat: (value: number) => `${value} u.`,
  },
};

export const CustomShape: Story = {
  name: "Custom SVG shape",
  args: {
    title: "Cera en el pote",
    data: [{ id: "cera", name: "Cera mate", value: 0.37 }],
    shape: {
      path: "M4 5h16a1 1 0 0 1 1 1v2H3V6a1 1 0 0 1 1-1zM4 9h16v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
    },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: { height: 180 },
};
