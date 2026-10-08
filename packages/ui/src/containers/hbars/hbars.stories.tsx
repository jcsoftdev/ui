import type { Meta, StoryObj } from "@storybook/react-vite";
import { HBars } from "./hbars.js";

const ticks = [
  { position: 0, label: "0" },
  { position: 50, label: "10" },
  { position: 100, label: "20" },
];

const meta = {
  title: "Containers/HBars",
  component: HBars,
  tags: ["autodocs"],
  args: {
    variant: "stacked",
    scaleMax: 20,
    description: "Cortes y barbas por barbero esta semana",
    nameHeader: "Barbero",
    series: [
      { id: "cortes", label: "Cortes" },
      { id: "barbas", label: "Barbas" },
    ],
    rows: [
      { id: "diego", name: "Diego Quispe", values: [12, 6] },
      { id: "mateo", name: "Mateo Flores", values: [9, 4] },
      { id: "camila", name: "Camila Rojas", values: [7, 3] },
      { id: "andres", name: "Andrés Paredes", values: [3, 1], tone: "danger" },
    ],
    ticks,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["stacked", "paired"] },
    scaleMax: { control: "number" },
    threshold: { control: "number" },
    description: { control: "text" },
    nameHeader: { control: "text" },
    series: { control: false },
    rows: { control: false },
    ticks: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-lg border border-line bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Paired: Story = {
  args: {
    variant: "paired",
    scaleMax: 40,
    description: "Citas agendadas frente a atendidas por barbero",
    series: [
      { id: "agendadas", label: "Agendadas" },
      { id: "atendidas", label: "Atendidas" },
    ],
    rows: [
      { id: "diego", name: "Diego Quispe", values: [34, 31] },
      { id: "mateo", name: "Mateo Flores", values: [28, 22] },
      { id: "camila", name: "Camila Rojas", values: [25, 25] },
    ],
    ticks: [
      { position: 0, label: "0" },
      { position: 50, label: "20" },
      { position: 100, label: "40" },
    ],
  },
};

export const WithThreshold: Story = {
  args: {
    scaleMax: 100,
    threshold: 30,
    description: "Stock de productos frente al mínimo de 30 unidades",
    nameHeader: "Producto",
    series: [{ id: "stock", label: "Unidades" }],
    rows: [
      { id: "pomada", name: "Pomada mate", values: [24], tone: "danger" },
      { id: "cera", name: "Cera brillo", values: [58] },
      { id: "shampoo", name: "Shampoo barba", values: [82] },
      { id: "navajas", name: "Navajas", values: [12], tone: "danger", valueText: "12 u." },
    ],
    ticks: [
      { position: 0, label: "0" },
      { position: 50, label: "50" },
      { position: 100, label: "100" },
    ],
  },
};

export const SingleSeriesWithoutTicks: Story = {
  args: {
    scaleMax: 1000,
    description: "Ingresos por barbero",
    series: [{ id: "ingresos", label: "Ingresos (S/)" }],
    rows: [
      { id: "diego", name: "Diego Quispe", values: [840], valueText: "S/ 840" },
      { id: "mateo", name: "Mateo Flores", values: [610], valueText: "S/ 610" },
    ],
    ticks: undefined,
  },
};
