import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CalendarMarker } from "../internal/types.js";
import { DayChip } from "./day-chip.js";

const marker: CalendarMarker = {
  id: "m1",
  date: "2026-10-08",
  title: "Feriado: Combate de Angamos",
  subtitle: "Local cerrado",
  tone: "danger",
  srLabel: "Feriado:",
};

const meta = {
  title: "Calendar/DayChip",
  component: DayChip,
  tags: ["autodocs"],
  args: { marker },
  argTypes: {
    marker: { control: "object" },
    onOpen: { action: "open" },
    className: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { a11y: { test: "todo" } } };

export const Accent: Story = {
  parameters: { a11y: { test: "todo" } },
  args: {
    marker: {
      ...marker,
      id: "m2",
      tone: "accent",
      title: "Pedido de pomadas",
      subtitle: "Llega 15:00",
    },
  },
};

export const WithoutSubtitle: Story = {
  parameters: { a11y: { test: "todo" } },
  args: { marker: { ...marker, subtitle: undefined, title: "Día del Barbero" } },
};

export const Truncated: Story = {
  parameters: { a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="max-w-[160px]">
        <Story />
      </div>
    ),
  ],
};
