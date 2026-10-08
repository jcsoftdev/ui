import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressUnits } from "./progress-units.js";

const meta = {
  title: "Charts/ProgressUnits",
  component: ProgressUnits,
  tags: ["autodocs"],
  args: {
    label: "Calificación de Kevin",
    value: 4.5,
    max: 5,
    count: 5,
    variant: "icons",
    icon: "star",
    size: 24,
    gap: 0.18,
    showValue: true,
    animate: true,
    loading: false,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["icons", "segments"] },
    icon: {
      control: "select",
      options: ["star", "scissors", "chair", "person", "calendar", "bottle"],
    },
    tone: {
      control: "select",
      options: ["neutral", "accent", "danger", "warning", "success"],
    },
    value: { control: { type: "range", min: 0, max: 5, step: 0.1 } },
    size: { control: { type: "range", min: 12, max: 48, step: 1 } },
    step: { control: { type: "number", min: 0, step: 0.25 } },
    valueFormat: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressUnits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ExactPartial: Story = {
  name: "Exact partial (4.3)",
  args: { label: "Promedio de reseñas", value: 4.3 },
};

export const HalfSteps: Story = {
  name: "Rounded to half stars",
  args: { label: "Reseñas de Renzo", value: 3.74, step: 0.5, tone: "warning" },
};

export const BookingSteps: Story = {
  name: "Segments (booking steps)",
  args: {
    label: "Reserva: paso 3 de 4",
    variant: "segments",
    value: 3,
    max: 4,
    count: 4,
    size: 20,
    valueFormat: "integer",
  },
};

export const CapacityCells: Story = {
  name: "Segments (capacity cells)",
  args: {
    label: "Ocupación del local",
    variant: "segments",
    value: 68,
    max: 100,
    count: 10,
    size: 22,
    tone: "success",
    valueFormat: (value: number) => `${value}%`,
  },
};

export const Chairs: Story = {
  name: "Chair icons (chairs taken)",
  args: {
    label: "Sillas ocupadas",
    icon: "chair",
    value: 4,
    max: 6,
    count: 6,
    size: 30,
    valueFormat: "integer",
  },
};

export const Loading: Story = { args: { loading: true } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: { size: 32, count: 10, max: 10, value: 7.5 },
};
