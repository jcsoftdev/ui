import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartDataTable } from "./data-table.js";

const meta = {
  title: "Charts/Primitives/ChartDataTable",
  component: ChartDataTable,
  tags: ["autodocs"],
  args: {
    caption: "Ventas por servicio de la semana",
    categoryHeader: "Día",
    categories: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    columns: [
      {
        id: "cortes",
        name: "Cortes",
        values: ["S/ 420", "S/ 380", "S/ 450", "S/ 510", "S/ 690", "S/ 840"],
      },
      {
        id: "barba",
        name: "Barba",
        values: ["S/ 150", "S/ 120", "S/ 180", "S/ 210", "S/ 260", "S/ 390"],
      },
    ],
  },
  argTypes: {
    caption: { control: "text" },
    categoryHeader: { control: "text" },
    categories: { control: "object" },
    columns: { control: "object" },
  },
  decorators: [
    (Story) => (
      <div>
        <p className="mb-2 text-ink-3 text-meta">
          La tabla es solo para lectores de pantalla; aquí se muestra visible para revisarla.
        </p>
        <div className="[&_.sr-only]:static [&_.sr-only]:m-0 [&_.sr-only]:h-auto [&_.sr-only]:w-auto [&_.sr-only]:overflow-visible [&_.sr-only]:[clip:auto] [&_.sr-only]:whitespace-normal [&_caption]:mb-2 [&_caption]:text-left [&_caption]:font-bold [&_td]:px-3 [&_td]:py-1 [&_th]:px-3 [&_th]:py-1 [&_th]:text-left [&_table]:text-ink [&_table]:text-meta">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ChartDataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MissingValues: Story = {
  args: {
    columns: [
      { id: "cortes", name: "Cortes", values: ["S/ 420", "S/ 380", "", "S/ 510"] },
      { id: "color", name: "Color", values: ["", "S/ 90", "S/ 120"] },
    ],
    categories: ["Lunes", "Martes", "Miércoles", "Jueves"],
  },
};
