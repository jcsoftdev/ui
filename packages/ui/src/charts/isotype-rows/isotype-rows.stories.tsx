import type { Meta, StoryObj } from "@storybook/react-vite";
import { IsotypeRows } from "./isotype-rows.js";

const servicesByBarber = [
  { id: "kevin", name: "Kevin", value: 42 },
  { id: "renzo", name: "Renzo", value: 38 },
  { id: "abel", name: "Abel", value: 51 },
  { id: "diego", name: "Diego", value: 29 },
  { id: "luis", name: "Luis", value: 35 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Barbero",
};

const meta = {
  title: "Charts/IsotypeRows",
  component: IsotypeRows,
  tags: ["autodocs"],
  args: {
    title: "Servicios por barbero esta semana",
    data: servicesByBarber,
    perIcon: 5,
    icon: "scissors",
    colorMode: "single",
    track: false,
    rowHeight: 34,
    gap: 0.18,
    valueFormat: "integer",
    showValues: true,
    unitLabel: "servicios",
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    icon: {
      control: "select",
      options: ["scissors", "person", "chair", "star", "calendar", "bottle"],
    },
    colorMode: { control: "inline-radio", options: ["single", "category"] },
    perIcon: { control: { type: "number", min: 1, step: 1 } },
    rowHeight: { control: { type: "range", min: 20, max: 60, step: 2 } },
    gap: { control: { type: "range", min: 0, max: 0.6, step: 0.02 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IsotypeRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ColorPerRow: Story = { args: { colorMode: "category" } };

export const WithTrack: Story = { name: "Track to the longest row", args: { track: true } };

export const IconPerRow: Story = {
  name: "Icon per row",
  args: {
    title: "Ventas del día (1 ícono = 2)",
    data: [
      { id: "cortes", name: "Cortes", value: 23, icon: "scissors" },
      { id: "afeitados", name: "Afeitados", value: 12, icon: "person" },
      { id: "shampoo", name: "Shampoo", value: 7, icon: "bottle" },
      { id: "citas", name: "Citas web", value: 15, icon: "calendar" },
    ],
    perIcon: 2,
    colorMode: "category",
    unitLabel: "ventas",
    labels: { ...spanishLabels, category: "Tipo" },
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
};
