import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kanban } from "./kanban.js";
import type { KanbanColumnData } from "./model.js";

const columns: KanbanColumnData[] = [
  {
    id: "reservadas",
    title: "Reservadas",
    cards: [
      {
        id: "c1",
        title: "Corte clásico",
        description: "Luis Ramírez, 16:00",
        tag: "Corte",
        assignee: "Diego Quispe",
        meta: "S/ 35",
      },
      {
        id: "c2",
        title: "Perfilado de barba",
        description: "Marco Salazar, 16:30",
        tag: "Barba",
        assignee: "Diego Quispe",
        meta: "S/ 25",
      },
      {
        id: "c3",
        title: "Corte + barba",
        description: "Andrés Paredes, 17:00",
        tag: "Combo",
        assignee: "Rosa Mendoza",
        meta: "S/ 55",
      },
    ],
  },
  {
    id: "en-silla",
    title: "En la silla",
    wipLimit: 2,
    cards: [
      {
        id: "c4",
        title: "Degradado",
        description: "Jorge Castillo",
        tag: "Corte",
        assignee: "Rosa Mendoza",
        meta: "S/ 40",
      },
      {
        id: "c5",
        title: "Afeitado con toalla caliente",
        description: "Renzo Vargas",
        tag: "Barba",
        assignee: "Diego Quispe",
        meta: "S/ 30",
      },
    ],
  },
  {
    id: "cobro",
    title: "Por cobrar",
    wipLimit: 3,
    cards: [{ id: "c6", title: "Corte infantil", description: "Mateo, 8 años", meta: "S/ 25" }],
  },
  { id: "listas", title: "Atendidas", cards: [] },
];

const meta = {
  title: "Containers/Kanban",
  component: Kanban,
  tags: ["autodocs"],
  args: { defaultColumns: columns, enforceLimit: false, emptyLabel: "Sin citas" },
  argTypes: {
    enforceLimit: { control: "boolean" },
    emptyLabel: { control: "text" },
    columns: { control: false },
    defaultColumns: { control: false },
    onColumnsChange: { control: false },
    renderCard: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Kanban>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

/** Drops into a column at its WIP limit are refused and announced. */
export const EnforcedLimit: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { enforceLimit: true },
};

export const Narrow: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const BrutalPreset: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="brutal" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};

export const GlassCompact: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div data-style="glass" data-density="compact" className="bg-bg p-card">
        <Story />
      </div>
    ),
  ],
};
